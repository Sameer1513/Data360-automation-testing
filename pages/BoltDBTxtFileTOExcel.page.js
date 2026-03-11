
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

class BoltDBTxtFileTOExcel {
    constructor() {
        // this.inputTxtPath = path.join(__dirname, 'textfile.txt');
        this.outputDir = path.join(process.cwd(), 'exports', 'ActualData');
        // this.outputFile = `ActualData_${Date.now()}.xlsx`;

        this.unitSystem = 'imperial'; 

        // Precision configuration for non-whole numbers
        this.roundingConfig = {
            'Tilt': 0,
            'Distance': 2,
            'Travel Speed': 1, 
            'Voltage': 1,
            'Current': 2,
            'Wire Speed': 0,
            'Oscillation Width': 3,
            'Target': 0,
            'Horizontal Bias': 2,
            'Frequency': 0,
            'Total Wire Consumed': 2,
            'True Energy':2,
            'Heat': 1
        };
    }

    formatToIST(rawValue) {
        if (!rawValue || isNaN(rawValue)) return rawValue;

        // Python: epoch_seconds = raw_value * 1000
        // JS: new Date() expects milliseconds, so we do (seconds * 1000)
        const epochMilliseconds = Number(rawValue) * 1000 * 1000;
        const date = new Date(epochMilliseconds);

        // Python: dt.strftime("%d-%b-%Y, %I:%M:%S %p")
        // Note: Using 'numeric' for hour to match "9:08" (no leading zero) seen in Production
        const formatter = new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata' // UTC +5:30
        });

        const parts = formatter.formatToParts(date);
        const p = {};
        parts.forEach(part => p[part.type] = part.value);
        
        // FIX: Convert '0' hour to '12' to match UI 12-hour format (e.g., 0:18 AM -> 12:18 AM)
        if (p.hour === '0') p.hour = '12';
        
        // Matches format: 13-Dec-2024, 9:08:35 PM
        return `${p.day}-${p.month}-${p.year}, ${p.hour}:${p.minute}:${p.second} ${p.dayPeriod.toUpperCase()}`;
    }

    applyRounding(key, value) {
        const num = Number(value || 0);
        // If it's a whole number, return as integer (e.g., 50.0 -> 50)
        if (num % 1 === 0) return Math.round(num); 
        
        const precision = this.roundingConfig[key] !== undefined ? this.roundingConfig[key] : 2;
        return parseFloat(num.toFixed(precision));
    }

parseAutomationFile() {
    const raw = fs.readFileSync(this.inputTxtPath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    
    const weldSessions = [];
    let currentSession = null;

    for (const line of lines) {
        if (!line.startsWith('{')) continue;
        try {
            const obj = JSON.parse(line);
            
           if (obj.Record === 'S') {
                // If a previous session existed without a 'C', we close it automatically
                currentSession = {
                    setupData: { ...obj, WeldID: obj.Weld_number || 'N/A' },
                    tRecords: [],
                    hasS: true,
                    hasC: false,
                    hasT: false,
                    sTime: parseFloat(obj.Time),
                    cTime: null
                };
                weldSessions.push(currentSession);
            } else if (obj.Record === 'T') {
                if (!currentSession) {
                    // Scenario: T records found before any S record
                    currentSession = { setupData: { WeldID: 'Unknown (S Missing)' }, tRecords: [], hasS: false, hasC: false, hasT: false };
                    weldSessions.push(currentSession);
                }
                currentSession.tRecords.push(obj);
                currentSession.hasT = true;
            } else if (obj.Record === 'C') {
                if (currentSession) {
                    currentSession.hasC = true;
                    currentSession.cTime = parseFloat(obj.Time);
                }
            
            }
        } catch (e) {}
    }
    return weldSessions;
}


async run(slopeIn = 0, slopeOut = 0,projectName='Default',sourceFile='default', BoltDBExcel = false) {
    this.inputTxtPath = path.join(process.cwd(), 'Input', sourceFile); 

    if (!fs.existsSync(this.inputTxtPath)) {
        throw new Error(`❌ ASSERTION FAILED: Source file missing at ${this.inputTxtPath}`);
    }

    console.log(`DEBUG: BoltDBTxtFileTOExcel.run called for project ${projectName}, source ${sourceFile}, BoltDBExcel = ${BoltDBExcel}`);
    console.log(`📂 Reading from: ${this.inputTxtPath}`);
    const weldSessions = this.parseAutomationFile();
    const workbook = new ExcelJS.Workbook();
    const fileName = `BoltD_${projectName}_${Date.now()}.xlsx`;
    
    // --- A. SETUP SHEET LOGIC ---
    const setupSheet = workbook.addWorksheet('Setup');
    let setupHeadersAdded = false;

    // --- B. PREPARE ANALYSIS SHEETS ---
    const analysisHeaders = [
        'Weld ID', 'Event', 'Time', 'Tilt', 'Pass', 'Zone', 'Distance',
        'Travel Speed', 'Voltage', 'Current', 'Wire Speed', 'Oscillation Width',
        'Target', 'Horizontal Bias', 'Frequency', 'Total Wire Consumed', 'True Energy', 'Heat'
    ];
    const analysisSheetNames = ['Pass_tlogs_data', 'Zone_tlogs_data', 'Tilt_tlogs_data'];
    const analysisSheets = {};
    analysisSheetNames.forEach(name => {
        const sheet = workbook.addWorksheet(name);
        sheet.addRow(analysisHeaders);
        sheet.getRow(1).font = { bold: true };
        analysisSheets[name] = sheet;
    });

    let allDataForViews = [];

    // --- C. LOOP THROUGH EACH SESSION ---
    weldSessions.forEach((session, index) => {
        const { setupData, tRecords, hasS, hasT, hasC } = session;

        // 1. Add to Setup Sheet with "Missing" Status
        let missing = [];
        if (!hasS) missing.push('S-Record missing');
        if (!hasT) missing.push('T-Records missing');
        if (!hasC) missing.push('C-Record missing');
        const status = missing.length > 0 ? `⚠️ ${missing.join(', ')}` : '✅ Complete';

        const setupRowData = { ...setupData, Processing_Status: status };
        if (!setupHeadersAdded) {
            setupSheet.addRow(Object.keys(setupRowData)).font = { bold: true };
            setupHeadersAdded = true;
        }
        setupSheet.addRow(Object.values(setupRowData));

        // 2. Local Helper: mapRecord (Updated to include setupRef)
        const mapRecord = (r, type) => {
            const p = type === 'Lead' ? 'Lead_' : 'Trail_';
            const current = parseFloat(r[p + 'amps'] || 0);
            const volts = parseFloat(r[p + 'volts'] || 0);
            const travelSpeed = parseFloat(r.Travel_speed || 1);
            const calcHeat = (0.06 * current * volts) / travelSpeed;

            return {
                'WeldID': setupData.WeldID || 'N/A',
                 'Event': r.Event, 
                'Time': this.formatToIST(r.Time), // 🌟 Keeps seconds for Tlogs
                'ViewTime': this.formatToIST(r.Time).replace(/:\d{2}\s/, ' '), // 🌟 Strips seconds for Views
                'rawTime': Number(r.Time),
                'Tilt': this.applyRounding('Tilt', r.Tilt), 'Torch': type,
                'Pass': r[p + 'pass_name'] || "NA", 'Zone': r[p + 'pass_name'] || "NA",
                'Distance': this.applyRounding('Distance', r.Distance),
                'Travel Speed': this.applyRounding('Travel Speed', r.Travel_speed),
                'Voltage': this.applyRounding('Voltage', volts),
                'Current': this.applyRounding('Current', current),
                'Wire Speed': this.applyRounding('Wire Speed', r[p + 'wire_speed']),
                'Oscillation Width': this.applyRounding('Oscillation Width', r[p + 'oscillate_width']),
                'Target': this.applyRounding('Target', r[p + 'target']),
                'Horizontal Bias': this.applyRounding('Horizontal Bias', r[p + 'horizontal_bias']),
                'Frequency': this.applyRounding('Frequency', r[p + 'frequency']),
                'Total Wire Consumed': this.applyRounding('Total Wire Consumed', r[p + 'total_wire_consumed']),
                'True Energy': this.applyRounding('Heat', r[p + 'heat']),
                'Heat': this.applyRounding('Heat', calcHeat),
                'setupRef': setupData, // Crucial for View Sheets
                'sessionSTime': session.sTime,
                'sessionCTime': session.cTime
            };
        };

        // 3. Local Helper: applySlope
        const applySlope = (records, sIn, sOut) => {
            if (records.length === 0) return [];
            const sorted = [...records].sort((a, b) => parseFloat(a.Time) - parseFloat(b.Time));
            const startT = parseFloat(sorted[0].Time);
            const endT = parseFloat(sorted[sorted.length - 1].Time);
            return sorted.filter(r => {
                const curT = parseFloat(r.Time);
                const diffStart = Math.round((curT - startT) * 1000);
                const diffEnd = Math.round((endT - curT) * 1000);
                return (diffStart >= sIn) && (diffEnd >= sOut);
            });
        };

        // 4. Process Data for this session
        const leadRecords = tRecords.filter(r => r.Lead_amps !== undefined && r.Lead_amps !== "");
        const trailRecords = tRecords.filter(r => r.Trail_amps !== undefined && r.Trail_amps !== "");

        const sessionProcessedData = [
            ...applySlope(leadRecords, slopeIn, slopeOut).map(r => mapRecord(r, 'Lead')),
            ...applySlope(trailRecords, slopeIn, slopeOut).map(r => mapRecord(r, 'Trail'))
        ].filter(d => d.Zone !== "NA");

        // 5. Add rows to Analysis Sheets
        sessionProcessedData.forEach(d => {
            const row = [
                d.WeldID, d.Event, d.Time, d.Tilt, d.Pass, d.Zone, d.Distance,
                d['Travel Speed'], d.Voltage, d.Current, d['Wire Speed'], d['Oscillation Width'],
                d.Target, d['Horizontal Bias'], d.Frequency, d['Total Wire Consumed'], d['True Energy'], d.Heat
            ];
            analysisSheetNames.forEach(name => analysisSheets[name].addRow(row));
        });

        allDataForViews.push(...sessionProcessedData);
    });

    // --- D. VIEW SHEETS (Calculated using combined data) ---
    // ⚠️ VALIDATION: If we have sessions but no actual data points, it's a failure.
    if (weldSessions.length > 0 && allDataForViews.length === 0) {
        throw new Error(`❌ EXTRACTION FAILED: Processed ${weldSessions.length} weld sessions but found no valid T-records (data points) to analyze. Aborting Excel generation.`);
    }

    this.addViewSheet(workbook, 'Pass_View', allDataForViews, d => `${d.WeldID}_${d.Torch}`);
    this.addViewSheet(workbook, 'Zone_View', allDataForViews, d => `${d.WeldID}_${d.Torch}_${d.Zone}`);
    this.addViewSheet(workbook, 'Tilt_View', allDataForViews, d => {
        const range = (d.Tilt >= 0 && d.Tilt <= 90) ? '0 - 90' : '90 - 180';
        d.tiltRangeLabel = range;
        return `${d.WeldID}_${d.Torch}_${range}`;
    });

    let outputPath = null;
    if (BoltDBExcel) {
        outputPath = path.join(this.outputDir, fileName);
        if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
        console.log(`✍️  Writing ActualData to: ${outputPath}`);
        await workbook.xlsx.writeFile(outputPath);
        console.log(`✅ Success: Processed ${weldSessions.length} weld sessions.`);
    }

    // Return extracted setup data for configuration derivation
    // FIX: Use the LAST valid session to ensure we get the most recent configuration from the log file
    const validSession = [...weldSessions].reverse().find(s => s.hasS && s.setupData);
    const setupData = validSession ? {
        pipeSize: validSession.setupData.Pipe_diameter,
        wallThickness: validSession.setupData.Band_diameter,
        wps: validSession.setupData.Job_number
    } : null;

    return { setupData, outputPath };
}   


addViewSheet(workbook, name, data, groupFn) {
    const sheet = workbook.addWorksheet(name);

    // 1. Headers
    const headers = ['Weld ID', 'Station', 'Welder ID', 'Bug Type', 'Torch', 'Weld Start Time', 'Weld Time'];
    if (name === 'Zone_View') headers.push('Zone');
    if (name === 'Tilt_View') headers.push('Tilt Range');
    headers.push('Distance', 'Travel Speed', 'Voltage', 'Current', 'Wire Speed', 'Oscillation Width', 'Target', 'Horizontal Bias', 'Frequency', 'Total Wire Consumed', 'True Energy', 'Heat');
    sheet.addRow(headers).font = { bold: true };

    // 2. Group the data
   const groups = {};
        data.forEach(d => {
            const key = groupFn(d);
            if (!groups[key]) {
                groups[key] = { 
                    items: [], 
                    torch: d.Torch, 
                    zoneName: d.Zone, 
                    setup: d.setupRef, // Each group now knows its own Weld ID / Station
                    sTime: d.sessionSTime,
                    cTime: d.sessionCTime
                };
            }
            groups[key].items.push(d);
        });

    // 3. Process each group
    // 3. Process each group
    Object.values(groups).forEach(g => {
        const sortedItems = g.items.sort((a, b) => a.rawTime - b.rawTime);
        
        let totalSeconds = 0;
        if (name === 'Pass_View' && g.sTime && g.cTime) {
            totalSeconds = Math.round((g.cTime - g.sTime) * 1000);
        } else if (sortedItems.length > 0) {
            totalSeconds = Math.round((sortedItems[sortedItems.length - 1].rawTime - sortedItems[0].rawTime) * 1000);
        }
        
        if (totalSeconds < 0 || isNaN(totalSeconds)) totalSeconds = 0;

        const avg = (key) => {
            const list = g.items.map(i => i[key]);
            const sum = list.reduce((a, b) => a + Number(b || 0), 0);
            const averageValue = sum / list.length;
            return key === 'Current' ? Math.round(averageValue) : this.applyRounding(key, averageValue);
        };
      
    let passStartTimeStr = '';
        if (g.sTime) {
            passStartTimeStr = this.formatToIST(g.sTime).replace(/:\d{2}\s/, ' ');
        } else {
            passStartTimeStr = sortedItems[0].ViewTime; 
        }

       const rowData = [
                g.setup.WeldID || 'N/A',
                g.setup.Station_number ? `Station ${g.setup.Station_number}` : 'N/A',
                g.setup.Welder_id || 'N/A',
                (g.setup.Bug_type || '').toUpperCase().includes('CCW') ? 'CCW' : 'CW',
                g.torch,
                passStartTimeStr,
                `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
            ];

        if (name === 'Zone_View') rowData.push(g.zoneName || 'N/A');
        if (name === 'Tilt_View') rowData.push(g.items[0].tiltRangeLabel || 'N/A');

        rowData.push(
            avg('Distance'), avg('Travel Speed'), avg('Voltage'), avg('Current'),
            avg('Wire Speed'), avg('Oscillation Width'), avg('Target'),
            avg('Horizontal Bias'), avg('Frequency'), avg('Total Wire Consumed'),
            avg('True Energy'), avg('Heat')
        );

        sheet.addRow(rowData);
    });
}
}

module.exports = BoltDBTxtFileTOExcel;