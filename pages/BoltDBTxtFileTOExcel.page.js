const fs   = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// ─────────────────────────────────────────────────────────────────────────────
// BoltDBTxtFileTOExcel
//
// Reads the raw automation text file (BoltDB export), parses S/T/C records,
// applies slope filtering, maps zones to pass names via WeldParameters file,
// checks values against limits from StatusConfig file, and writes results
// to an Excel workbook with Setup, tlog, view, and Unknown sheets.
//
// ── STATUS SYMBOLS (matching UI display) ─────────────────────────────────────
//   'true'  → S+T+C present, all values within limits
//   'false' → S+T+C present, at least one value outside limits
//   '(-)'   → S missing OR T missing (weld incomplete / no data)
//   '(X)'   → C record missing, values within limits (weld not formally closed)
//   '(!)'   → zone exists in T record but not found in WeldParams file
//             (pass name cannot be determined → limits cannot be checked)
//
// ── MISSING RECORD RULES (same for ALL calculation methods) ──────────────────
//   S missing OR T missing              → '(-)'
//   S+T present, C missing, pass limits → '(X)'
//   S+T present, C missing, fail limits → 'false'
//   Zone not in WeldParams              → '(!)'
//
// ── CALCULATION METHODS ──────────────────────────────────────────────────────
//   Instantaneous    → check every individual T record against limits
//                      any single T record outside limits → 'false'
//
//   Average by Pass  → average all T records in the pass group → check limits
//                      (same formula for Pass_View, Zone_View, Tilt_View)
//
//   Average by Zone  → Pass_View : avg per zone, if any zone fails → pass fails
//                      Zone_View : avg of T records in that zone → check limits
//                      Tilt_View : avg of T records in tilt range → check limits
//
//   Average by Tilt  → Pass_View : avg of ALL T records in pass → check limits
//                                  (independent of tilt ranges, same as Avg by Pass)
//                      Zone_View : avg of T records in that zone → check limits
//                      Tilt_View : avg of T records in tilt range → check limits
//
// Note: For all Average methods, individual tlog values do NOT affect status.
//       Only the computed average is compared against the configured limits.
// ─────────────────────────────────────────────────────────────────────────────

class BoltDBTxtFileTOExcel {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'exports', 'ActualData');
        // unitSystem and roundingConfig are loaded from Combinations.json at run time
        // via the unitConfig parameter of run()
        this.unitSystem    = 'imperial';
        this.roundingConfig = {};

        // Columns in view/tlog sheets that are checked against limits
        // dataKey = key in the mapped record object
        // configName = row label in StatusConfig_UI Parameter table
        this.LIMIT_PARAMS = [
            { dataKey: 'Current',           configName: 'Current (A)'            },
            { dataKey: 'Voltage',           configName: 'Volts (V)'              },
            { dataKey: 'Wire Speed',        configName: 'Wire Speed (in/min)'    },
            { dataKey: 'Travel Speed',      configName: 'Travel Speed (in/min)'  },
            { dataKey: 'Oscillation Width', configName: 'Oscillation Width (in)' },
            { dataKey: 'Heat',              configName: 'Heat (kJ/in)'           },
            { dataKey: 'True Energy',       configName: 'True Energy (kJ/in)'    },
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    formatToIST(rawValue) {
        if (!rawValue || isNaN(rawValue)) return rawValue;
        const date = new Date(Number(rawValue) * 1000 * 1000);
        const formatter = new Intl.DateTimeFormat('en-US', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: 'numeric', minute: '2-digit', second: '2-digit',
            hour12: true, timeZone: 'Asia/Kolkata'
        });
        const parts = formatter.formatToParts(date);
        const p = {};
        parts.forEach(part => p[part.type] = part.value);
        if (p.hour === '0') p.hour = '12';
        // en-US gives 3-letter month abbreviations (Sep, Oct, Nov etc.) matching production UI
        return `${p.day}-${p.month}-${p.year}, ${p.hour}:${p.minute}:${p.second} ${p.dayPeriod.toUpperCase()}`;
    }

    applyRounding(key, value) {
        const num = Number(value || 0);
        if (num % 1 === 0) return Math.round(num);
        const precision = this.roundingConfig[key] !== undefined ? this.roundingConfig[key] : 2;
        return parseFloat(num.toFixed(precision));
    }

    // Map PassName → StatusConfig group column
    // passGroups is the list of group names read directly from StatusConfig headers (e.g. ["Hot Pass","Fill","Cap"])
    // Matching: check if the group name appears inside the passName (case-insensitive)
    // e.g. passName="Fill 1" matches group="Fill", passName="Cap 2" matches group="Cap"
    // passName="Hot Pass" exactly matches group="Hot Pass"
    // No hardcoded assumptions — works for any StatusConfig layout
    toStatusGroup(passName, passGroups) {
        if (!passName || !passGroups || passGroups.length === 0) return null;
        const upper = passName.toString().toUpperCase();
        // First try exact match (case-insensitive)
        for (const g of passGroups) {
            if (upper === g.toUpperCase()) return g;
        }
        // Then try: group name is contained in passName
        for (const g of passGroups) {
            if (upper.includes(g.toUpperCase())) return g;
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD WELD PARAMETERS — builds zone→passName map per torch
    // Source: WeldParametersCsvToExcel.xlsx (or whatever file is configured)
    // Reads 'Lead Torch' and 'Trail Torch' sheets
    // Row 3 = PassName, Row 4 = PassPendName (zone)
    // ─────────────────────────────────────────────────────────────────────────

    async loadZoneMap(weldParamsPath) {
        if (!weldParamsPath || !fs.existsSync(weldParamsPath)) {
            console.warn('⚠️  WeldParams file not found — zone→passName mapping will be skipped');
            return { lead: {}, trail: {} };
        }

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(weldParamsPath);

        const buildMap = (sheetName) => {
            const ws = wb.getWorksheet(sheetName);
            if (!ws) return {};
            const map = {};  // zone (PassPendName) → passName

            // Row 3 = PassName, Row 4 = PassPendName (1-indexed in ExcelJS)
            const nameRow = ws.getRow(3);
            const pendRow = ws.getRow(4);

            pendRow.eachCell({ includeEmpty: false }, (cell, colIdx) => {
                if (colIdx === 1) return; // skip label column
                const zone     = (cell.value || '').toString().trim().toUpperCase();
                const passName = (nameRow.getCell(colIdx).value || '').toString().trim().toUpperCase();
                if (zone && passName && !map[zone]) {
                    map[zone] = passName; // first occurrence wins (duplicates are same PassName)
                }
            });
            return map;
        };

        const lead  = buildMap('Lead Torch');
        const trail = buildMap('Trail Torch');

        // Zone map is strictly from WeldParameters file only — no fallbacks added here.
        // Any zone not present in the file will produce (!) status — matching UI behaviour.

        const lCount = Object.keys(lead).length;
        const tCount = Object.keys(trail).length;
        console.log(`📗 Zone map loaded | Lead: ${lCount} zones, Trail: ${tCount} zones`);
        return { lead, trail };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD STATUS CONFIG — extracts method, level, limits table
    // Source: XML_StatusConfig_UI.xlsx (or whatever file is configured)
    // ─────────────────────────────────────────────────────────────────────────

    async loadStatusConfig(statusConfigPath) {
        if (!statusConfigPath || !fs.existsSync(statusConfigPath)) {
            console.warn('⚠️  StatusConfig file not found — status will default to true (no limits check)');
            return null;
        }

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(statusConfigPath);
        const ws = wb.getWorksheet('Status_Config_UI');
        if (!ws) {
            console.warn('⚠️  Sheet "Status_Config_UI" not found — status will default to true');
            return null;
        }

        const config = { method: null, level: null, params: {} };

        // Read method + level from header block
        ws.eachRow(row => {
            const a = (row.getCell(1).value || '').toString().trim();
            const b = (row.getCell(2).value || '').toString().trim();
            if (a === 'Status Calculation Method') config.method = b;
            if (a === 'Status Calculation Level')  config.level  = b;
        });

        // Find parameter table header row (row where col A = "Parameter")
        let headerRowNum  = null;
        const passGroups  = []; // ["Hot Pass", "Fill", "Cap"]
        const colMap      = {}; // {"Hot Pass Min": 2, "Hot Pass Max": 3, ...}

        ws.eachRow((row, rowNum) => {
            if ((row.getCell(1).value || '').toString().trim() !== 'Parameter') return;
            headerRowNum = rowNum;
            row.eachCell({ includeEmpty: false }, (cell, colIdx) => {
                if (colIdx === 1) return;
                const header = (cell.value || '').toString().trim();
                colMap[header] = colIdx;
                const match = header.match(/^(.+?)\s+(Min|Max)$/i);
                if (match && !passGroups.includes(match[1].trim())) {
                    passGroups.push(match[1].trim());
                }
            });
        });

        if (!headerRowNum) {
            console.warn('⚠️  Parameter table not found in StatusConfig — status will default to true');
            return null;
        }

        // Read each parameter row
        ws.eachRow((row, rowNum) => {
            if (rowNum <= headerRowNum) return;
            const paramName = (row.getCell(1).value || '').toString().trim();
            if (!paramName) return;
            config.params[paramName] = {};
            passGroups.forEach(group => {
                config.params[paramName][group] = {
                    min: parseFloat(row.getCell(colMap[`${group} Min`])?.value) || 0,
                    max: parseFloat(row.getCell(colMap[`${group} Max`])?.value) || 0,
                };
            });
        });

        config.passGroups = passGroups;  // group names from StatusConfig headers
        console.log(`📋 StatusConfig loaded | Method: ${config.method} | Level: ${config.level} | Groups: ${passGroups.join(', ')}`);
        return config;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK VALUE AGAINST LIMITS
    // Returns: { pass: bool, outOfLimitKeys: Set<dataKey> }
    // ─────────────────────────────────────────────────────────────────────────

    checkLimits(record, passName, statusConfig) {
        const result = { pass: true, outOfLimitKeys: new Set() };
        if (!statusConfig || !passName) return result;

        const statusGroup = this.toStatusGroup(passName, statusConfig?.passGroups);
        if (!statusGroup) return result;

        for (const p of this.LIMIT_PARAMS) {
            const limitGroup = statusConfig.params[p.configName]?.[statusGroup];
            if (!limitGroup) continue;

            const { min, max } = limitGroup;
            if (min === 0 && max === 0) continue; // not configured

            const val = parseFloat(record[p.dataKey]);
            if (isNaN(val)) continue;

            if ((min && val < min) || (max && val > max)) {
                result.pass = false;
                result.outOfLimitKeys.add(p.dataKey);
            }
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // APPLY STATUS ROW STYLING — mirrors the production UI row colors exactly
    //   true  → green row  (UI: bg-green-100  rgb 220,252,231)
    //   false → red row    (UI: bg-red-100    rgb 254,226,226)
    //           + bold red text on out-of-limit cells
    //   (!)   → yellow row (UI: bg-yellow-100 rgb 254,249,195)
    //   (X)   → orange row (UI: bg-orange-100 rgb 255,237,213)
    //   (-)   → no fill    (UI: grey is ignored by production page)
    // ─────────────────────────────────────────────────────────────────────────

    applyStatusStyle(excelRow, status, outOfLimitColNums = []) {
        // Only the out-of-limit cells get highlighted — no full row fill
        // Out-of-limit cells: red background + bold red text
        outOfLimitColNums.forEach(colNum => {
            const cell = excelRow.getCell(colNum);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // red-100 bg
            cell.font = { bold: true, color: { argb: 'FFDC2626' } };                            // red-600 text
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMPUTE SESSION STATUS based on STC record presence
    // ─────────────────────────────────────────────────────────────────────────

    computeSessionStatus(hasS, hasT, hasC) {
        // S or T missing — session has no meaningful data
        if (!hasS || !hasT) return '(-)';
        // C missing: limits still checked — result is (X) if pass, false if fail
        // Handled per-record — return null here so limit check runs normally
        return null; // null = compute from limits (C missing handled downstream)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARSE AUTOMATION FILE
    // ─────────────────────────────────────────────────────────────────────────

    parseAutomationFile() {
        const raw   = fs.readFileSync(this.inputTxtPath, 'utf-8');
        const lines = raw.split(/\r?\n/).filter(l => l.trim());

        const weldSessions = [];
        let currentSession = null;
        // After a C record closes a session, sessionClosed = true.
        // Any T records that arrive before the next S go to an Unknown session,
        // matching the UI behaviour where orphaned T records are stored under Unknown Weld ID.
        let sessionClosed = false;

        for (const line of lines) {
            if (!line.startsWith('{')) continue;
            try {
                const obj = JSON.parse(line);

                if (obj.Record === 'S') {
                    sessionClosed  = false;
                    currentSession = {
                        setupData: { ...obj, WeldID: obj.Weld_number || 'N/A' },
                        tRecords: [],
                        hasS: true, hasC: false, hasT: false,
                        sTime: parseFloat(obj.Time), cTime: null
                    };
                    weldSessions.push(currentSession);

                } else if (obj.Record === 'T') {
                    // If the current session is already closed (C received, no new S yet)
                    // OR there was never an S at all → orphan → Unknown session
                    if (!currentSession || sessionClosed) {
                        // Reuse an existing trailing Unknown session or create a new one
                        const last = weldSessions[weldSessions.length - 1];
                        if (last && last.setupData.WeldID === 'Unknown') {
                            last.tRecords.push(obj);
                            last.hasT = true;
                        } else {
                            const unknownSession = {
                                setupData: { WeldID: 'Unknown' },
                                tRecords: [obj],
                                hasS: false, hasC: false, hasT: true,
                                sTime: null, cTime: null
                            };
                            weldSessions.push(unknownSession);
                            console.warn(`⚠️  T record after C with no new S — stored in Unknown session`);
                        }
                    } else {
                        currentSession.tRecords.push(obj);
                        currentSession.hasT = true;
                    }

                } else if (obj.Record === 'C') {
                    if (currentSession && !sessionClosed) {
                        currentSession.hasC = true;
                        currentSession.cTime = parseFloat(obj.Time);
                        sessionClosed = true;  // Mark session as closed — next T without S → Unknown
                    }
                }
            } catch (e) {}
        }
        return weldSessions;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN RUN
    // Combinations.json should include:
    //   "statusConfigPath": "exports/StatusConfig UI/XML_StatusConfig_UI.xlsx"
    //   "weldParamsPath":   "exports/StatusConfig UI/WeldParametersCsvToExcel.xlsx"
    // Both paths relative to process.cwd(). Pass them into run() from the spec.
    // ─────────────────────────────────────────────────────────────────────────

    async run(slopeIn = 0, slopeOut = 0, projectName = 'Default', sourceFile = 'default',
              BoltDBExcel = false, statusConfigPath = null, weldParamsPath = null, unitConfig = null) {

        // Apply unit config from Combinations.json (unitSystem + roundingConfig)
        if (unitConfig) {
            this.unitSystem     = (unitConfig.unitSystem || 'imperial').toLowerCase();
            const rounding      = unitConfig.roundingConfig || {};
            const key           = this.unitSystem === 'metric' ? 'metric' : 'imperial';
            this.roundingConfig = rounding[key] || rounding || {};
        }
        console.log(`📐 Unit system: ${this.unitSystem} | Rounding keys: ${Object.keys(this.roundingConfig).length}`);

        this.inputTxtPath = path.join(process.cwd(), 'Input', sourceFile);
        if (!fs.existsSync(this.inputTxtPath)) {
            throw new Error(`❌ Source file missing at ${this.inputTxtPath}`);
        }

        console.log(`📂 BoltDB run | Project: ${projectName} | Source: ${sourceFile}`);

        // Load external config files
        const statusConfig = await this.loadStatusConfig(statusConfigPath);
        const zoneMap      = await this.loadZoneMap(weldParamsPath);

        const method = (statusConfig?.method || '').toLowerCase();
        const level  = (statusConfig?.level  || '').toLowerCase();

        const isInstantaneous = method.includes('instantaneous');
        const isAvgZone       = method.includes('average') && level.includes('zone');
        const isAvgTilt       = method.includes('average') && level.includes('tilt');
        const isAvgPass       = method.includes('average') && !isAvgZone && !isAvgTilt;

        const weldSessions = this.parseAutomationFile();
        const workbook     = new ExcelJS.Workbook();
        const fileName     = `BoltD_${projectName}_${Date.now()}.xlsx`;

        // ── A. SETUP SHEET ────────────────────────────────────────────────────
        const setupSheet = workbook.addWorksheet('Setup');
        let setupHeadersAdded = false;

        // ── B. TLOG SHEETS (with Status + limit highlighting) ─────────────────
        // Status column added at col 3 (after Weld ID, Sl.no) — matching UI
        const tlogHeaders = [
            'Weld ID', 'Sl.no', 'Status', 'Event', 'Time', 'Tilt', 'Pass', 'Zone',
            'Distance', 'Travel Speed', 'Voltage', 'Current', 'Wire Speed',
            'Oscillation Width', 'Target', 'Horizontal Bias', 'Frequency',
            'Total Wire Consumed', 'True Energy', 'Heat'
        ];
        // Col indices (1-based) for limit-checked params in tlog sheet
        // Position = index in tlogHeaders + 1
        const tlogLimitColMap = {};
        this.LIMIT_PARAMS.forEach(p => {
            const idx = tlogHeaders.indexOf(p.dataKey);
            if (idx !== -1) tlogLimitColMap[p.dataKey] = idx + 1;
        });

        const tlogSheetNames = ['Pass_tlogs_data', 'Zone_tlogs_data', 'Tilt_tlogs_data'];
        const tlogSheets = {};
        let tlogSlNo = 1;
        let tlogCurrentWeldId = null;  // tracks when WeldID changes to reset Sl.no
        let tlogCurrentTorch  = null;  // tracks when Torch changes to reset Sl.no
        tlogSheetNames.forEach(name => {
            const ws = workbook.addWorksheet(name);
            ws.addRow(tlogHeaders).font = { bold: true };
            tlogSheets[name] = ws;
        });

        // Unknown sheet — T records with no S record (S record was never written to the file)
        const unknownSheet = workbook.addWorksheet('Unknown');
        unknownSheet.addRow(tlogHeaders).font = { bold: true };
        let unknownSlNo = 1;

        let allDataForViews = [];

        // ── C. PROCESS EACH SESSION ───────────────────────────────────────────
        weldSessions.forEach(session => {
            const { setupData, tRecords, hasS, hasT, hasC } = session;

            // Session-level status (missing record flags)
            const sessionStatusFlag = this.computeSessionStatus(hasS, hasT, hasC);

            // Setup sheet — only for sessions with an S record (Unknown sessions have no setup data)
            if (hasS) {
                const missing = [];
                if (!hasT) missing.push('T-Records missing');
                if (!hasC) missing.push('C-Record missing');
                const procStatus = missing.length > 0 ? `⚠️ ${missing.join(', ')}` : '✅ Complete';
                const setupRowData = {
                    ...setupData,
                    C_Record_Present: hasC ? 'Yes' : 'No',
                    C_Record_Time:    hasC ? this.formatToIST(session.cTime) : '(missing)',
                    Processing_Status: procStatus
                };
                if (!setupHeadersAdded) {
                    setupSheet.addRow(Object.keys(setupRowData)).font = { bold: true };
                    setupHeadersAdded = true;
                }
                const setupExcelRow = setupSheet.addRow(Object.values(setupRowData));
                // Highlight row orange if C record is missing
                if (!hasC) {
                    setupExcelRow.eachCell({ includeEmpty: true }, cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
                    });
                }
            } else {
                console.warn(`⚠️  Unknown session (no S record) — T records will go to Unknown sheet`);
            }

            // ── Map T records ──────────────────────────────────────────────
            const mapRecord = (r, torchType) => {
                const p        = torchType === 'Lead' ? 'Lead_' : 'Trail_';
                const current  = parseFloat(r[p + 'amps']  || 0);
                const volts    = parseFloat(r[p + 'volts'] || 0);
                const tSpeed   = parseFloat(r.Travel_speed || 1);
                const calcHeat = (0.06 * current * volts) / tSpeed;

                // Zone = raw pass_name from T record (e.g. "1T", "2M")
                const zoneName = (r[p + 'pass_name'] || '').toString().trim().toUpperCase();

                // PassName = looked up from WeldParameters zone map
                const torchMap = torchType === 'Lead' ? zoneMap.lead : zoneMap.trail;
                const passName = zoneName ? (torchMap[zoneName] || null) : null;

                return {
                    WeldID:             setupData.WeldID || 'N/A',
                    Event:              r.Event,
                    Time:               this.formatToIST(r.Time),
                    ViewTime:           this.formatToIST(r.Time).replace(/:\d{2}\s/, ' '),
                    rawTime:            Number(r.Time),
                    Tilt:               this.applyRounding('Tilt', r.Tilt),
                    Torch:              torchType,
                    Zone:               zoneName  || null,  // raw zone name from T record
                    Pass:               passName  || null,  // mapped PassName from WeldParams
                    Distance:           this.applyRounding('Distance', r.Distance),
                    'Travel Speed':     this.applyRounding('Travel Speed', r.Travel_speed),
                    Voltage:            this.applyRounding('Voltage', volts),
                    Current:            this.applyRounding('Current', current),
                    'Wire Speed':       this.applyRounding('Wire Speed', r[p + 'wire_speed']),
                    'Oscillation Width':this.applyRounding('Oscillation Width', r[p + 'oscillate_width']),
                    Target:             this.applyRounding('Target', r[p + 'target']),
                    'Horizontal Bias':  this.applyRounding('Horizontal Bias', r[p + 'horizontal_bias']),
                    Frequency:          this.applyRounding('Frequency', r[p + 'frequency']),
                    'Total Wire Consumed': this.applyRounding('Total Wire Consumed', r[p + 'total_wire_consumed']),
                    'True Energy':      this.applyRounding('Heat', r[p + 'heat']),
                    Heat:               this.applyRounding('Heat', calcHeat),
                    setupRef:           setupData,
                    sessionSTime:       session.sTime,
                    sessionCTime:       session.cTime,
                    sessionStatusFlag,  // '(-)' or null
                    sessionHasC:        hasC,  // used in view status: (X) vs false when C missing
                };
            };

            const applySlope = (records, sIn, sOut) => {
                if (records.length === 0) return [];
                const sorted = [...records].sort((a, b) => parseFloat(a.Time) - parseFloat(b.Time));
                const startT = parseFloat(sorted[0].Time);
                const endT   = parseFloat(sorted[sorted.length - 1].Time);
                return sorted.filter(r => {
                    const curT      = parseFloat(r.Time);
                    const dStart    = Math.round((curT - startT) * 1000);
                    const dEnd      = Math.round((endT - curT) * 1000);
                    return dStart >= sIn && dEnd >= sOut;
                });
            };

            const leadRecs  = tRecords.filter(r => r.Lead_amps  !== undefined && r.Lead_amps  !== '');
            const trailRecs = tRecords.filter(r => r.Trail_amps !== undefined && r.Trail_amps !== '');

            const sessionData = [
                ...applySlope(leadRecs,  slopeIn, slopeOut).map(r => mapRecord(r, 'Lead')),
                ...applySlope(trailRecs, slopeIn, slopeOut).map(r => mapRecord(r, 'Trail'))
            ].filter(d => d.Zone !== null); // drop records with no zone at all

            // ── Add rows to tlog sheets ────────────────────────────────────
            sessionData.forEach(d => {
                // Determine per-tlog status
                let tlogStatus;
                if (sessionStatusFlag) {
                    // S or T missing → forced (-) status
                    tlogStatus = sessionStatusFlag;
                } else if (!d.Pass) {
                    // Pass name could not be resolved from zone map
                    tlogStatus = '(!)';
                } else {
                    // Check limits per tlog row
                    const limCheck = this.checkLimits(d, d.Pass, statusConfig);
                    if (!hasC) {
                        // C record missing: (X) if within limits, false if out of limits
                        tlogStatus = limCheck.pass ? '(X)' : 'false';
                    } else {
                        tlogStatus = limCheck.pass ? 'true' : 'false';
                    }
                }

                // Reset Sl.no when WeldID or Torch changes
                if (d.WeldID !== tlogCurrentWeldId || d.Torch !== tlogCurrentTorch) {
                    tlogSlNo = 1;
                    tlogCurrentWeldId = d.WeldID;
                    tlogCurrentTorch  = d.Torch;
                }
                const row = [
                    d.WeldID, tlogSlNo++, tlogStatus,
                    d.Event, d.Time, d.Tilt, d.Pass || '(!)', d.Zone,
                    d.Distance, d['Travel Speed'], d.Voltage, d.Current,
                    d['Wire Speed'], d['Oscillation Width'], d.Target,
                    d['Horizontal Bias'], d.Frequency, d['Total Wire Consumed'],
                    d['True Energy'], d.Heat
                ];

                // Out-of-limit columns (shared for both tlog and unknown sheet)
                let outOfLimitCols = [];
                if (tlogStatus === 'false' && statusConfig && d.Pass) {
                    const { outOfLimitKeys } = this.checkLimits(d, d.Pass, statusConfig);
                    Object.entries(tlogLimitColMap).forEach(([dataKey, colNum]) => {
                        if (outOfLimitKeys.has(dataKey)) outOfLimitCols.push(colNum);
                    });
                }

                if (!hasS) {
                    // No S record — row goes to Unknown sheet only, not tlog sheets or view sheets
                    const unknownRow = unknownSheet.addRow([
                        'Unknown', unknownSlNo++, tlogStatus,
                        d.Event, d.Time, d.Tilt, d.Pass || '(!)', d.Zone,
                        d.Distance, d['Travel Speed'], d.Voltage, d.Current,
                        d['Wire Speed'], d['Oscillation Width'], d.Target,
                        d['Horizontal Bias'], d.Frequency, d['Total Wire Consumed'],
                        d['True Energy'], d.Heat
                    ]);
                    this.applyStatusStyle(unknownRow, tlogStatus, outOfLimitCols);
                } else {
                    // Normal session — write to all three tlog sheets and include in view sheets
                    tlogSheetNames.forEach(sheetName => {
                        const ws       = tlogSheets[sheetName];
                        const excelRow = ws.addRow(row);
                        this.applyStatusStyle(excelRow, tlogStatus, outOfLimitCols);
                    });
                    allDataForViews.push(d);
                }
            });
        });

        // ── D. VIEW SHEETS ────────────────────────────────────────────────────
        if (weldSessions.length > 0 && allDataForViews.length === 0) {
            throw new Error(`❌ Processed ${weldSessions.length} sessions but found no valid T-records.`);
        }

        // ── Pre-compute zone avg statuses (only needed for Average by Zone → Pass_View) ──
        // For Average by Zone method, Pass_View status = fail if ANY zone within the pass fails.
        // We pre-compute zone-level statuses here so Pass_View can look them up per zone key.
        // Key format: "WeldID_Torch_Zone" → 'true' | 'false'
        const zoneStatusMap = {};
        if (isAvgZone) {
            this._buildGroupedStatuses(
                allDataForViews,
                d => `${d.WeldID}_${d.Torch}_${d.Zone}`,
                zoneStatusMap,
                statusConfig
            );
        }
        // Note: Average by Tilt no longer needs a pre-computed tilt map.
        // Pass_View for Average by Tilt uses the pass average directly (same as Average by Pass).

        // ── Pass_View: one row per Weld ID + Torch ────────────────────────────
        this.addViewSheet(workbook, 'Pass_View', allDataForViews,
            d => `${d.WeldID}_${d.Torch}`,
            (g, avgs) => this._resolveViewStatus(g, avgs, statusConfig,
                isInstantaneous, isAvgPass, isAvgZone, isAvgTilt,
                zoneStatusMap, 'pass'),
            statusConfig
        );

        // ── Zone_View: one row per Weld ID + Torch + Zone ─────────────────────
        this.addViewSheet(workbook, 'Zone_View', allDataForViews,
            d => `${d.WeldID}_${d.Torch}_${d.Zone}`,
            (g, avgs) => this._resolveViewStatus(g, avgs, statusConfig,
                isInstantaneous, isAvgPass, isAvgZone, isAvgTilt,
                zoneStatusMap, 'zone'),
            statusConfig
        );

        // ── Tilt_View: one row per Weld ID + Torch + Tilt Range (0-90 / 90-180) ─
        this.addViewSheet(workbook, 'Tilt_View', allDataForViews,
            d => {
                const range = (d.Tilt >= 0 && d.Tilt <= 90) ? '0 - 90' : '90 - 180';
                d.tiltRangeLabel = range;
                return `${d.WeldID}_${d.Torch}_${range}`;
            },
            (g, avgs) => this._resolveViewStatus(g, avgs, statusConfig,
                isInstantaneous, isAvgPass, isAvgZone, isAvgTilt,
                zoneStatusMap, 'tilt'),
            statusConfig
        );

        // ── E. SAVE ───────────────────────────────────────────────────────────
        let outputPath = null;
        if (BoltDBExcel) {
            outputPath = path.join(this.outputDir, fileName);
            if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
            await workbook.xlsx.writeFile(outputPath);
            console.log(`✅ BoltDB Excel saved: ${outputPath}`);
        }

        const validSession = [...weldSessions].reverse().find(s => s.hasS && s.setupData);
        const setupData = validSession ? {
            pipeSize:      validSession.setupData.Pipe_diameter,
            wallThickness: validSession.setupData.Band_diameter,
            wps:           validSession.setupData.Job_number
        } : null;

        return { setupData, outputPath };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESOLVE VIEW-LEVEL STATUS
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // RESOLVE VIEW-LEVEL STATUS
    //
    // Called once per row in Pass_View / Zone_View / Tilt_View.
    // 'g'       = group object { items, passName, sessionHasC, ... }
    // 'avgs'    = flat object of averaged param values for this group's T records
    // 'viewType'= 'pass' | 'zone' | 'tilt' — which sheet is being computed
    //
    // ── Missing record rules (same for ALL methods) ───────────────────────────
    //   S missing OR T missing          → '(-)'
    //   S+T present, C missing, pass    → '(X)'
    //   S+T present, C missing, fail    → 'false'
    //   Zone exists but not in WeldParams→ '(!)'
    //
    // ── Method rules (only when S+T+C all present) ───────────────────────────
    //
    //   Instantaneous  (all views):
    //     Check every individual T record against limits.
    //     If ANY single T record is outside limits → 'false', else → 'true'
    //
    //   Average by Pass (all views):
    //     Compute average of all T records in the group → check against limits.
    //     Individual tlog values are irrelevant — only the average matters.
    //
    //   Average by Zone:
    //     Pass_View  → compute avg per zone. If ANY zone avg fails → 'false'
    //     Zone_View  → compute avg of T records in that zone → check limits
    //     Tilt_View  → compute avg of T records in that tilt range → check limits
    //
    //   Average by Tilt:
    //     Pass_View  → compute avg of ALL T records in the pass → check limits
    //                  (same as Average by Pass — tilt ranges are independent of pass status)
    //     Zone_View  → compute avg of T records in that zone → check limits
    //     Tilt_View  → compute avg of T records in that tilt range → check limits
    //
    // ─────────────────────────────────────────────────────────────────────────
    _resolveViewStatus(g, avgs, statusConfig, isInstantaneous, isAvgPass,
                       isAvgZone, isAvgTilt, zoneStatusMap, viewType) {

        // ── Step 1: Check for missing S or T records ──────────────────────────
        // sessionStatusFlag is set to '(-)' when S or T is missing for the session.
        // All items in a group share the same session flag.
        // If ALL items carry the same non-null flag (only '(-)' reaches here), propagate it.
        const flags = [...new Set(g.items.map(i => i.sessionStatusFlag))];
        if (flags.length === 1 && flags[0] !== null) return flags[0];

        // ── Step 2: Check for missing pass name ───────────────────────────────
        // passName is null when the zone in the T record could not be found in WeldParams.
        // This means we cannot determine which limit group to check against.
        if (!g.passName) return '(!)';

        // ── Step 3: C record missing handling ─────────────────────────────────
        // C record missing does NOT skip the limit check — values are still compared.
        // Result becomes '(X)' instead of 'true' when limits pass,
        // and stays 'false' when limits fail.
        // All items in a group share the same session, so checking the first item is enough.
        const cMissing = g.items.length > 0 && !g.items[0].sessionHasC;

        // Helper: translate a limit check result into final status string
        // limPass = true  → 'true' (or '(X)' if C record is missing)
        // limPass = false → 'false' (regardless of C record presence)
        const passOrX = (limPass) => limPass ? (cMissing ? '(X)' : 'true') : 'false';

        // ── Step 4: No StatusConfig file provided ─────────────────────────────
        // If no status config is loaded, we can't check limits.
        // Treat as passing (no limits configured).
        if (!statusConfig) return cMissing ? '(X)' : 'true';

        // ── Step 5: Method-specific status calculation ────────────────────────

        // ── INSTANTANEOUS ─────────────────────────────────────────────────────
        // Every individual T record is checked. One failure fails the whole group.
        // This is the only method that depends on individual tlog values.
        if (isInstantaneous) {
            for (const item of g.items) {
                const { pass } = this.checkLimits(item, g.passName, statusConfig);
                if (!pass) return 'false';
            }
            return cMissing ? '(X)' : 'true';
        }

        // ── AVERAGE BY PASS ───────────────────────────────────────────────────
        // All views: average of all T records in the group → check limits.
        // Individual tlog values do not affect status — only the average matters.
        if (isAvgPass) {
            const { pass } = this.checkLimits(avgs, g.passName, statusConfig);
            return passOrX(pass);
        }

        // ── AVERAGE BY ZONE ───────────────────────────────────────────────────
        if (isAvgZone) {
            if (viewType === 'pass') {
                // Pass_View: check each zone's average independently.
                // Pre-computed zoneStatusMap holds avg-based status per zone key.
                // If ANY zone within this pass fails → the pass fails.
                const anyZoneFailed = g.items.some(item => {
                    const key = `${item.WeldID}_${item.Torch}_${item.Zone}`;
                    return zoneStatusMap[key] === 'false';
                });
                return anyZoneFailed ? 'false' : (cMissing ? '(X)' : 'true');
            }
            // Zone_View / Tilt_View: average of T records in this group → check limits.
            const { pass } = this.checkLimits(avgs, g.passName, statusConfig);
            return passOrX(pass);
        }

        // ── AVERAGE BY TILT ───────────────────────────────────────────────────
        if (isAvgTilt) {
            // Pass_View: average of ALL T records in the pass → check limits.
            // Tilt ranges are independent — pass status is not affected by tilt range results.
            // This behaves identically to Average by Pass for Pass_View.
            //
            // Zone_View / Tilt_View: average of T records in that group → check limits.
            // Same formula for all three views — only the grouping key differs.
            const { pass } = this.checkLimits(avgs, g.passName, statusConfig);
            return passOrX(pass);
        }

        // ── Fallback (should not be reached if method is configured) ──────────
        return cMissing ? '(X)' : 'true';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BUILD GROUPED STATUSES
    //
    // Pre-computes avg-based status for each group (e.g. each zone) and stores
    // it in statusMap keyed by groupFn(record).
    //
    // Currently used only for Average by Zone method → Pass_View:
    //   groupFn = d => `${d.WeldID}_${d.Torch}_${d.Zone}`
    //   statusMap = zoneStatusMap
    //
    // This lets Pass_View quickly look up "did zone X fail?" without
    // re-computing averages a second time during addViewSheet.
    // ─────────────────────────────────────────────────────────────────────────
    _buildGroupedStatuses(data, groupFn, statusMap, statusConfig) {
        const groups = this._buildGroups(data, groupFn);
        Object.entries(groups).forEach(([key, g]) => {
            const avgs      = this._computeAvgs(g.items);
            const { pass }  = this.checkLimits(avgs, g.passName, statusConfig);
            statusMap[key]  = pass ? 'true' : 'false';
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GROUP HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    _buildGroups(data, groupFn) {
        const groups = {};
        data.forEach(d => {
            const key = groupFn(d);
            if (!groups[key]) {
                groups[key] = {
                    items: [], torch: d.Torch, zoneName: d.Zone,
                    passName: null,  // resolved below after all items collected
                    setup: d.setupRef, sTime: d.sessionSTime, cTime: d.sessionCTime
                };
            }
            groups[key].items.push(d);
            // Always use first non-null Pass found across all items in the group
            // This ensures Tilt groups (0-90 / 90-180) get the passName from any item,
            // not just the first item which may have been added before Pass was resolved
            if (!groups[key].passName && d.Pass) {
                groups[key].passName = d.Pass;
            }
        });
        return groups;
    }

    _computeStats(items) {
        // Returns { 'Current': { min, avg, max }, 'Voltage': { min, avg, max }, ..., 'Distance': { avg } }
        const numericKeys = ['Travel Speed', 'Voltage', 'Current', 'Wire Speed', 'Oscillation Width',
                             'Target', 'Horizontal Bias', 'Frequency', 'Total Wire Consumed',
                             'True Energy', 'Heat'];
        const stats = {};
        numericKeys.forEach(key => {
            const vals = items.map(item => Number(item[key] || 0)).filter(v => !isNaN(v));
            if (vals.length === 0) { stats[key] = { min: 0, avg: 0, max: 0 }; return; }
            const sum = vals.reduce((a, b) => a + b, 0);
            const avg = sum / vals.length;
            const isInt = key === 'Current' || key === 'Frequency';
            const round = v => isInt ? Math.round(v) : this.applyRounding(key, v);
            stats[key] = { min: round(Math.min(...vals)), avg: round(avg), max: round(Math.max(...vals)) };
        });
        // Distance: avg only (used for status check compat)
        const distVals = items.map(i => Number(i['Distance'] || 0));
        stats['Distance'] = { avg: this.applyRounding('Distance', distVals.reduce((a,b)=>a+b,0)/distVals.length) };
        return stats;
    }

    // Backward-compat shim used by status-check methods (they expect flat avg object)
    _computeAvgs(items) {
        const s = this._computeStats(items);
        const flat = {};
        Object.entries(s).forEach(([k, v]) => { flat[k] = v.avg !== undefined ? v.avg : v; });
        return flat;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADD VIEW SHEET
    // Headers now include: Weld ID | Sl.no | Status | Station | Welder ID |
    //   Bug Type | Torch | Weld Start Time | Weld Time | [Zone/TiltRange] |
    //   Pass Name | Distance | Travel Speed | ...
    // ─────────────────────────────────────────────────────────────────────────

    addViewSheet(workbook, name, data, groupFn, statusFn = null, statusConfig = null) {
        const sheet = workbook.addWorksheet(name);

        // Params that show Min / Avg / Max columns (matching UI order)
        const tripleParams = [
            'Current (A)', 'Voltage (V)', 'Travel Speed (in/min)',
            'True Energy (kJ/in)', 'Heat (kJ/in)',
            'Wire Speed (in/min)', 'Oscillation Width (in)',
            'Frequency', 'Target', 'Horizontal Bias', 'Total Wire Consumed'
        ];
        // Internal dataKey for each display label
        const paramKey = {
            'Current (A)':            'Current',
            'Voltage (V)':            'Voltage',
            'Travel Speed (in/min)':  'Travel Speed',
            'True Energy (kJ/in)':    'True Energy',
            'Heat (kJ/in)':           'Heat',
            'Wire Speed (in/min)':    'Wire Speed',
            'Oscillation Width (in)': 'Oscillation Width',
            'Frequency':              'Frequency',
            'Target':                 'Target',
            'Horizontal Bias':        'Horizontal Bias',
            'Total Wire Consumed':    'Total Wire Consumed',
        };

        const headers = ['Weld ID', 'Sl.no', 'Status', 'Station', 'Welder ID',
                         'Bug Type', 'Torch', 'Weld Start Time', 'Weld Time'];
        if (name === 'Zone_View') headers.push('Zone');
        if (name === 'Tilt_View') headers.push('Tilt Range');
        headers.push('Pass Name', 'Distance');
        tripleParams.forEach(label => {
            headers.push(`${label} Min`, `${label} Avg`, `${label} Max`);
        });
        sheet.addRow(headers).font = { bold: true };

        const groups = this._buildGroups(data, groupFn);
        let slNo = 1;
        let viewCurrentWeldId = null;  // tracks WeldID to reset Sl.no per weld

        Object.values(groups).forEach(g => {
            const sortedItems = g.items.sort((a, b) => a.rawTime - b.rawTime);

            // Weld time: only compute if C record present, else show (-)
            const hasCRecord = !!g.cTime;
            let weldTimeStr = '(-)';
            if (hasCRecord) {
                let totalSeconds = 0;
                if (name === 'Pass_View' && g.sTime && g.cTime) {
                    totalSeconds = Math.round((g.cTime - g.sTime) * 1000);
                } else if (sortedItems.length > 0) {
                    totalSeconds = Math.round(
                        (sortedItems[sortedItems.length - 1].rawTime - sortedItems[0].rawTime) * 1000
                    );
                }
                if (totalSeconds < 0 || isNaN(totalSeconds)) totalSeconds = 0;
                weldTimeStr = `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
            }

            const stats = this._computeStats(g.items);
            const avgs  = this._computeAvgs(g.items); // flat avgs for status check
            const status = statusFn ? statusFn(g, avgs) : 'true';

            let passStartTimeStr = g.sTime
                ? this.formatToIST(g.sTime).replace(/:\d{2}\s/, ' ')
                : sortedItems[0]?.ViewTime || '';

            // Reset Sl.no when WeldID changes
            const rowWeldId = g.setup.WeldID || 'N/A';
            if (rowWeldId !== viewCurrentWeldId) {
                slNo = 1;
                viewCurrentWeldId = rowWeldId;
            }
            const rowData = [
                rowWeldId,
                slNo++,
                status,
                g.setup.Station_number ? `Station ${g.setup.Station_number}` : 'N/A',
                g.setup.Welder_id || 'N/A',
                (g.setup.Bug_type || '').toUpperCase().includes('CCW') ? 'CCW' : 'CW',
                g.torch,
                passStartTimeStr,
                weldTimeStr
            ];

            if (name === 'Zone_View') rowData.push(g.zoneName || 'N/A');
            if (name === 'Tilt_View') rowData.push(g.items[0]?.tiltRangeLabel || 'N/A');

            rowData.push(g.passName || '(!)');    // Pass Name
            rowData.push(stats['Distance'].avg);  // Distance (single value)
            tripleParams.forEach(label => {
                const key = paramKey[label];
                const s   = stats[key] || { min: '', avg: '', max: '' };
                rowData.push(s.min, s.avg, s.max);
            });

            const excelRow = sheet.addRow(rowData);

            // Collect out-of-limit column numbers (all 3 of min/avg/max for that param)
            let outOfLimitCols = [];
            if (status === 'false' && g.passName && statusConfig) {
                const { outOfLimitKeys } = this.checkLimits(avgs, g.passName, statusConfig);
                this.LIMIT_PARAMS.forEach(p => {
                    // Find the display label for this dataKey
                    const label = Object.keys(paramKey).find(l => paramKey[l] === p.dataKey);
                    if (!label || !outOfLimitKeys.has(p.dataKey)) return;
                    // Highlight Min, Avg, Max columns for this param
                    ['Min', 'Avg', 'Max'].forEach(suffix => {
                        const colIdx = headers.indexOf(`${label} ${suffix}`) + 1;
                        if (colIdx > 0) outOfLimitCols.push(colIdx);
                    });
                });
            }

            // Apply out-of-limit cell highlights
            this.applyStatusStyle(excelRow, status, outOfLimitCols);
        });
    }
}

module.exports = BoltDBTxtFileTOExcel;