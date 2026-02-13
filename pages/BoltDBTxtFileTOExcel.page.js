
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

class BoltDBTxtFileTOExcel {
    constructor() {
        this.inputTxtPath = path.join(__dirname, 'AUTOMATION.txt');
        this.outputDir = path.join(__dirname, '..', 'exports');
        this.outputFile = `ActualData_${Date.now()}.xlsx`;

        this.unitSystem = 'imperial'; 

        // Precision configuration for non-whole numbers
        this.roundingConfig = {
            'Tilt': 0,
            'Distance': 2,
            'Travel Speed': 0, 
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
        const tRecords = [];
        let setupData = {};

        for (const line of lines) {
            if (!line.startsWith('{')) continue;
            try {
                const obj = JSON.parse(line);
                if (obj.Record === 'S') {
                    setupData = obj;
                    // DERIVATION POINT: Map "Weld_number" to "Weld ID"
                    setupData.WeldID = obj.Weld_number || 'N/A';
                } else if (obj.Record === 'T') {
                    tRecords.push(obj);
                }
            } catch (e) {}
        }
        return { tRecords, setupData };
    }


async run(slopeIn = 0, slopeOut = 0) { // 1. Added slope variables as arguments
        const { tRecords, setupData } = this.parseAutomationFile();
        const weldIdValue = setupData.WeldID;
        const workbook = new ExcelJS.Workbook();

        // 1. SETUP SHEET
        const setupSheet = workbook.addWorksheet('Setup');
        setupSheet.addRow(Object.keys(setupData));
        setupSheet.addRow(Object.values(setupData));
        setupSheet.getRow(1).font = { bold: true };

        const mapRecord = (r, type) => {
            const p = type === 'Lead' ? 'Lead_' : 'Trail_';
            
            const current = parseFloat(r[p + 'amps'] || 0);
            const volts = parseFloat(r[p + 'volts'] || 0);
            const travelSpeed = parseFloat(r.Travel_speed || 1); 

            const calcHeat = (0.06 * current * volts) / travelSpeed;

            return {
                'Event': r.Event,
                'Time': this.formatToIST(r.Time),
                'rawTime': Number(r.Time),
                'Tilt': this.applyRounding('Tilt', r.Tilt),
                'Torch': type,
                'Pass': r[p + 'pass_name'] || "NA", 
                'Zone': r[p + 'pass_name'] || "NA",
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
                'Heat': this.applyRounding('Heat', calcHeat)
            };
        };

        // --- SLOPE FILTERING LOGIC ---
        const applySlope = (records, sIn, sOut) => {
            if (records.length === 0) return [];
            // Sort by raw time to find start and end
            const sorted = [...records].sort((a, b) => parseFloat(a.Time) - parseFloat(b.Time));
            const startT = parseFloat(sorted[0].Time);
            const endT = parseFloat(sorted[sorted.length - 1].Time);

            return sorted.filter(r => {
                const curT = parseFloat(r.Time);
                // Convert kiloseconds diff to seconds
                const diffStart = Math.round((curT - startT) * 1000);
                const diffEnd = Math.round((endT - curT) * 1000);
                return (diffStart >= sIn) && (diffEnd >= sOut);
            });
        };

        // 2. Separate data by torch to apply slope and ensure "Lead then Trail" order
        const leadRecords = tRecords.filter(r => r.Lead_amps !== undefined && r.Lead_amps !== "");
        const trailRecords = tRecords.filter(r => r.Trail_amps !== undefined && r.Trail_amps !== "");

        const filteredLead = applySlope(leadRecords, slopeIn, slopeOut);
        const filteredTrail = applySlope(trailRecords, slopeIn, slopeOut);

        // 3. COMBINE DATA: Lead block first, then Trail block
        const allData = [
            ...filteredLead.map(r => mapRecord(r, 'Lead')),
            ...filteredTrail.map(r => mapRecord(r, 'Trail'))
        ].filter(d => d.Zone !== "NA");

        // --- END OF UPDATED LOGIC ---

        // Updated Headers to include True Energy
        const analysisHeaders = [
             'Weld ID','Event', 'Time', 'Tilt', 'Pass', 'Zone', 'Distance', 
            'Travel Speed', 'Voltage', 'Current', 'Wire Speed', 'Oscillation Width', 
            'Target', 'Horizontal Bias', 'Frequency', 'Total Wire Consumed', 'True Energy', 'Heat'
        ];

        // 2. DATA ANALYSIS SHEETS
        ['Pass_DataAnalysis', 'Zone_DataAnalysis', 'Tilt_DataAnalysis'].forEach(name => {
            const sheet = workbook.addWorksheet(name);
            sheet.addRow(analysisHeaders);
            allData.forEach(d => {
                sheet.addRow([weldIdValue,
                    d['Event'], d['Time'], d['Tilt'], d['Pass'], d['Zone'], d['Distance'],
                    d['Travel Speed'], d['Voltage'], d['Current'], d['Wire Speed'], d['Oscillation Width'],
                    d['Target'], d['Horizontal Bias'], d['Frequency'], d['Total Wire Consumed'], 
                    d['True Energy'], d['Heat']
                ]);
            });
            sheet.getRow(1).font = { bold: true };
        });

        // 3. VIEW SHEETS
        this.addViewSheet(workbook, 'Pass_View', allData, d => d.Torch, setupData);
        this.addViewSheet(workbook, 'Zone_View', allData, d => `${d.Torch}_${d.Zone}`, setupData);
        this.addViewSheet(workbook, 'Tilt_View', allData, d => {
            const range = (d.Tilt >= 0 && d.Tilt <= 90) ? '0 - 90' : '90 - 180';
            d.tiltRangeLabel = range;
            return `${d.Torch}_${range}`;
        }, setupData);

        const outputPath = path.join(this.outputDir, this.outputFile);
        if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
        await workbook.xlsx.writeFile(outputPath);
        console.log(`✅ Success: Slope applied (${slopeIn}s/${slopeOut}s) and order set to Lead -> Trail.`);
    }    


addViewSheet(workbook, name, data, groupFn, setupData) {
    const sheet = workbook.addWorksheet(name);

    // 1. Build Headers
    const headers = ['Weld ID','Station', 'Welder ID', 'Bug Type', 'Torch'];
    headers.push('Weld Start Time', 'Weld Time');
    // NEW: Add 'Zone' header only for Zone_View
    if (name === 'Zone_View') headers.push('Zone');
    if (name === 'Tilt_View') headers.push('Tilt Range');

    headers.push(
      'Distance', 'Travel Speed', 'Voltage', 'Current', 'Wire Speed',
      'Oscillation Width', 'Target', 'Horizontal Bias', 'Frequency',
      'Total Wire Consumed', 'True Energy', 'Heat'
    );
    sheet.addRow(headers);

    // 2. Group the data
    const groups = {};
    data.forEach(d => {
      const key = groupFn(d);
      if (!groups[key]) {
        groups[key] = { 
          items: [], 
          torch: d.Torch,
          zoneName: d.Zone // Store the Zone name (HO, TT, TM, etc.)
        };
      }
      groups[key].items.push(d);
    });

    // 3. Process each group
   Object.values(groups).forEach(g => {
    // 1. Define Bug Type first to avoid ReferenceError
    const rawBugType = (setupData.Bug_type || '').toUpperCase();
    const displayBugType = rawBugType.includes('CCW') ? 'CCW' : 'CW';

    // 2. High-precision time calculation
    // Sort using the raw numeric timestamp (rawTime)
    const sortedItems = g.items.sort((a, b) => a.rawTime - b.rawTime);
    
    const startTimeFormatted = sortedItems[0].Time;
    const startRaw = sortedItems[0].rawTime;
    const endRaw = sortedItems[sortedItems.length - 1].rawTime;
    
    // Difference in seconds (kiloseconds * 1000)
    const totalSeconds = Math.round((endRaw - startRaw) * 1000); 

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const weldTimeStr = `${minutes}m ${seconds}s`;

    // 3. Define the average helper function
    const avg = (key, list) => {
        const sum = list.reduce((a, b) => a + Number(b || 0), 0);
        const averageValue = sum / list.length;
        if (key === 'Current') return Math.round(averageValue);
        return this.applyRounding(key, averageValue);
    };

    // 4. Build the row data in the correct order
    const rowData = [
        setupData.Weld_number || 'N/A',
        setupData.Station_number ? `Station ${setupData.Station_number}` : 'N/A',
        setupData.Welder_id || 'N/A',
        displayBugType,       // Now defined!
        g.torch,
        startTimeFormatted, 
        weldTimeStr
    ];

    

      // NEW: Push the actual Zone name into the row ONLY for Zone_View
      if (name === 'Zone_View') {
        rowData.push(g.zoneName || 'N/A');
      }

      if (name === 'Tilt_View') {
        rowData.push(g.items[0].tiltRangeLabel || 'N/A');
      }

      // 4. Add the average values
      rowData.push(
        avg('Distance', g.items.map(i => i['Distance'])),
        avg('Travel Speed', g.items.map(i => i['Travel Speed'])),
        avg('Voltage', g.items.map(i => i['Voltage'])),
        avg('Current', g.items.map(i => i['Current'])),
        avg('Wire Speed', g.items.map(i => i['Wire Speed'])),
        avg('Oscillation Width', g.items.map(i => i['Oscillation Width'])),
        avg('Target', g.items.map(i => i['Target'])),
        avg('Horizontal Bias', g.items.map(i => i['Horizontal Bias'])),
        avg('Frequency', g.items.map(i => i['Frequency'])),
        avg('Total Wire Consumed', g.items.map(i => i['Total Wire Consumed'])),
        avg('True Energy', g.items.map(i => i['True Energy'])),
        avg('Heat', g.items.map(i => i['Heat']))
      );

      sheet.addRow(rowData);
    });

    sheet.getRow(1).font = { bold: true };
  }
}

module.exports = BoltDBTxtFileTOExcel;