

// const fs = require('fs');
// const path = require('path');
// const ExcelJS = require('exceljs');

// class ActualDataExtractor {
//     constructor() {
//         this.inputTxtPath = path.join(__dirname, 'AUTOMATION.txt');
//         this.outputDir = path.join(__dirname, '..', 'exports');
//         this.outputFile = `ActualData_Full_Comparison_${Date.now()}.xlsx`;

//         // TOGGLE: 'metric' or 'imperial'
//         this.unitSystem = 'imperial'; 

//         // Specific rounding based on your column requirements
//         this.roundingConfig = {
//             'Tilt': 0,
//             'Distance': this.unitSystem === 'metric' ? 1 : 3,
//             'Speed': 1,
//             'Volts': 1,
//             'Amps': 2,
//             'WireSpeed': 0,
//             'OscWidth': this.unitSystem === 'metric' ? 1 : 3,
//             'Target': 0,
//             'HorBias': 2,
//             'Freq': 0,
//             'TotalWire': 2,
//             'Heat': 2
//         };
//     }

//     applyRounding(key, value) {
//         const precision = this.roundingConfig[key] !== undefined ? this.roundingConfig[key] : 2;
//         const num = Number(value || 0);
//         return parseFloat(num.toFixed(precision));
//     }

//     parseAutomationFile() {
//         const raw = fs.readFileSync(this.inputTxtPath, 'utf-8');
//         const lines = raw.split(/\r?\n/).filter(l => l.trim());
//         const tRecords = [];
//         let setupData = {};

//         for (const line of lines) {
//             if (!line.startsWith('{')) continue;
//             try {
//                 const obj = JSON.parse(line);
//                 if (obj.Record === 'S') {
//                     setupData = obj;
//                 } else if (obj.Record === 'T') {
//                     tRecords.push(obj);
//                 }
//             } catch (e) {}
//         }
//         return { tRecords, setupData };
//     }

//     async run() {
//         const { tRecords, setupData } = this.parseAutomationFile();
//         const workbook = new ExcelJS.Workbook();

//         // 1. SETUP SHEET
//         const setupSheet = workbook.addWorksheet('Setup');
//         setupSheet.addRow(Object.keys(setupData));
//         setupSheet.addRow(Object.values(setupData));
//         setupSheet.getRow(1).font = { bold: true };

//         const mapRecord = (r, type) => {
//             const p = type === 'Lead' ? 'Lead_' : 'Trail_';
//             return {
//                 Event: r.Event,
//                 Time: r.Time,
//                 Tilt: this.applyRounding('Tilt', r.Tilt),
//                 Torch: type.toUpperCase(),
//                 Pass: r[p + 'pass_name'] || "NA",
//                 Distance: this.applyRounding('Distance', r.Distance),
//                 Speed: this.applyRounding('Speed', r.Travel_speed),
//                 Volts: this.applyRounding('Volts', r[p + 'volts']),
//                 Amps: this.applyRounding('Amps', r[p + 'amps']),
//                 WireSpeed: this.applyRounding('WireSpeed', r[p + 'wire_speed']),
//                 OscWidth: this.applyRounding('OscWidth', r[p + 'oscillate_width']),
//                 Target: this.applyRounding('Target', r[p + 'target']),
//                 HorBias: this.applyRounding('HorBias', r[p + 'horizontal_bias']),
//                 Freq: this.applyRounding('Freq', r[p + 'frequency']),
//                 TotalWire: this.applyRounding('TotalWire', r[p + 'total_wire_consumed']),
//                 Heat: this.applyRounding('Heat', r[p + 'heat'])
//             };
//         };

//         const allData = [
//             ...tRecords.map(r => mapRecord(r, 'Lead')),
//             ...tRecords.map(r => mapRecord(r, 'Trail'))
//         ].filter(d => d.Pass !== "NA");

//         const headers = [
//             'Event', 'Time', 'Tilt', 'Torch', 'Pass/Zone', 'Distance', 
//             'Speed', 'Volts', 'Amps', 'WireSpeed', 'OscWidth', 
//             'Target', 'HorBias', 'Freq', 'TotalWire', 'Heat'
//         ];

//         // 2. DATA ANALYSIS SHEETS
//         ['Pass_DataAnalysis', 'Zone_DataAnalysis', 'Tilt_DataAnalysis'].forEach(name => {
//             const sheet = workbook.addWorksheet(name);
//             sheet.addRow(headers);
//             allData.forEach(d => {
//                 sheet.addRow([
//                     d.Event, d.Time, d.Tilt, d.Torch, d.Pass, d.Distance,
//                     d.Speed, d.Volts, d.Amps, d.WireSpeed, d.OscWidth,
//                     d.Target, d.HorBias, d.Freq, d.TotalWire, d.Heat
//                 ]);
//             });
//             sheet.getRow(1).font = { bold: true };
//         });

//         // 3. VIEW SHEETS (ALL COLUMNS RESTORED)
//         this.addViewSheet(workbook, 'Pass_View', allData, d => d.Torch);
//         this.addViewSheet(workbook, 'Zone_View', allData, d => `${d.Torch}_${d.Pass}`);
//         this.addViewSheet(workbook, 'Tilt_View', allData, d => {
//             const range = (d.Tilt >= 0 && d.Tilt <= 90) ? '0 - 90' : '90 - 180';
//             return `${d.Torch}_${range}`;
//         });

//         const outputPath = path.join(this.outputDir, this.outputFile);
//         if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
//         await workbook.xlsx.writeFile(outputPath);
//         console.log(`✅ Success: All columns restored to View sheets using ${this.unitSystem} rounding.`);
//     }

//     addViewSheet(workbook, name, data, groupFn) {
//         const sheet = workbook.addWorksheet(name);
//         // Header matches Analysis except for the "Avg" prefix
//         sheet.addRow([
//              'Torch', 'Avg Distance', 'Avg Speed', 'Avg Volts', 
//             'Avg Amps', 'Avg WireSpeed', 'Avg OscWidth', 'Avg Target', 
//             'Avg HorBias', 'Avg Freq', 'Avg TotalWire', 'Avg Heat'
//         ]);

//         const groups = {};
//         data.forEach(d => {
//             const key = groupFn(d);
//             if (!groups[key]) groups[key] = { items: [], torch: d.Torch, label: key.includes('_') ? key.split('_')[1] : key };
//             groups[key].items.push(d);
//         });

//         Object.values(groups).forEach(g => {
//             const avg = (key, list) => {
//                 const sum = list.reduce((a, b) => a + Number(b || 0), 0);
//                 return this.applyRounding(key, sum / list.length);
//             };

//             sheet.addRow([
                
//                 g.torch,
                
//                 avg('Distance', g.items.map(i => i.Distance)),
//                 avg('Speed', g.items.map(i => i.Speed)),
//                 avg('Volts', g.items.map(i => i.Volts)),
//                 avg('Amps', g.items.map(i => i.Amps)),
//                 avg('WireSpeed', g.items.map(i => i.WireSpeed)),
//                 avg('OscWidth', g.items.map(i => i.OscWidth)),
//                 avg('Target', g.items.map(i => i.Target)),
//                 avg('HorBias', g.items.map(i => i.HorBias)),
//                 avg('Freq', g.items.map(i => i.Freq)),
//                 avg('TotalWire', g.items.map(i => i.TotalWire)),
//                 avg('Heat', g.items.map(i => i.Heat))
//             ]);
//         });
//         sheet.getRow(1).font = { bold: true };
//     }
// }

// module.exports = ActualDataExtractor;


const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

class ActualDataExtractor {
    constructor() {
        this.inputTxtPath = path.join(__dirname, 'AUTOMATION.txt');
        this.outputDir = path.join(__dirname, '..', 'exports');
        this.outputFile = `ActualData_Full_Comparison_${Date.now()}.xlsx`;

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
            'Heat': 2
        };
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
                } else if (obj.Record === 'T') {
                    tRecords.push(obj);
                }
            } catch (e) {}
        }
        return { tRecords, setupData };
    }

    async run() {
        const { tRecords, setupData } = this.parseAutomationFile();
        const workbook = new ExcelJS.Workbook();

        // 1. SETUP SHEET
        const setupSheet = workbook.addWorksheet('Setup');
        setupSheet.addRow(Object.keys(setupData));
        setupSheet.addRow(Object.values(setupData));
        setupSheet.getRow(1).font = { bold: true };

        const mapRecord = (r, type) => {
            const p = type === 'Lead' ? 'Lead_' : 'Trail_';
            // Extract the Zone name (e.g., "HO", "TO") from the pass_name field
            return {
                'Event': r.Event,
                'Time': r.Time,
                'Tilt': this.applyRounding('Tilt', r.Tilt),
                'Torch': type.toUpperCase(),
                'Pass': r[p + 'pass_name'] || "NA", 
                'Zone': r[p + 'pass_name'] || "NA", // Column renamed to 'Zone'
                'Distance': this.applyRounding('Distance', r.Distance),
                'Travel Speed': this.applyRounding('Travel Speed', r.Travel_speed),
                'Voltage': this.applyRounding('Voltage', r[p + 'volts']),
                'Current': this.applyRounding('Current', r[p + 'amps']),
                'Wire Speed': this.applyRounding('Wire Speed', r[p + 'wire_speed']),
                'Oscillation Width': this.applyRounding('Oscillation Width', r[p + 'oscillate_width']),
                'Target': this.applyRounding('Target', r[p + 'target']),
                'Horizontal Bias': this.applyRounding('Horizontal Bias', r[p + 'horizontal_bias']),
                'Frequency': this.applyRounding('Frequency', r[p + 'frequency']),
                'Total Wire Consumed': this.applyRounding('Total Wire Consumed', r[p + 'total_wire_consumed']),
                'Heat': this.applyRounding('Heat', r[p + 'heat'])
            };
        };

        const allData = [
            ...tRecords.map(r => mapRecord(r, 'Lead')),
            ...tRecords.map(r => mapRecord(r, 'Trail'))
        ].filter(d => d.Zone !== "NA");

        // Headers for Data Analysis (Exact matches, no units, 'Zone' only)
        const analysisHeaders = [
            'Event', 'Time', 'Tilt', 'Pass', 'Zone', 'Distance', 
            'Travel Speed', 'Voltage', 'Current', 'Wire Speed', 'Oscillation Width', 
            'Target', 'Horizontal Bias', 'Frequency', 'Total Wire Consumed', 'Heat'
        ];

        // 2. DATA ANALYSIS SHEETS
        ['Pass_DataAnalysis', 'Zone_DataAnalysis', 'Tilt_DataAnalysis'].forEach(name => {
            const sheet = workbook.addWorksheet(name);
            sheet.addRow(analysisHeaders);
            allData.forEach(d => {
                sheet.addRow([
                    d['Event'], d['Time'], d['Tilt'], d['Pass'], d['Zone'], d['Distance'],
                    d['Travel Speed'], d['Voltage'], d['Current'], d['Wire Speed'], d['Oscillation Width'],
                    d['Target'], d['Horizontal Bias'], d['Frequency'], d['Total Wire Consumed'], d['Heat']
                ]);
            });
            sheet.getRow(1).font = { bold: true };
        });

        // 3. VIEW SHEETS
        this.addViewSheet(workbook, 'Pass_View', allData, d => d.Torch);
        this.addViewSheet(workbook, 'Zone_View', allData, d => `${d.Torch}_${d.Zone}`);
        this.addViewSheet(workbook, 'Tilt_View', allData, d => {
            const range = (d.Tilt >= 0 && d.Tilt <= 90) ? '0 - 90' : '90 - 180';
            return `${d.Torch}_${range}`;
        });

        const outputPath = path.join(this.outputDir, this.outputFile);
        if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
        await workbook.xlsx.writeFile(outputPath);
        console.log(`✅ Success: Headers updated to 'Zone' and cleaned for comparison script.`);
    }

    addViewSheet(workbook, name, data, groupFn) {
        const sheet = workbook.addWorksheet(name);
        sheet.addRow([
             'Torch', 'Avg Distance', 'Avg Travel Speed', 'Avg Voltage', 
            'Avg Current', 'Avg Wire Speed', 'Avg Oscillation Width', 'Avg Target', 
            'Avg Horizontal Bias', 'Avg Frequency', 'Avg Total Wire Consumed', 'Avg Heat'
        ]);

        const groups = {};
        data.forEach(d => {
            const key = groupFn(d);
            if (!groups[key]) groups[key] = { items: [], torch: d.Torch };
            groups[key].items.push(d);
        });

        Object.values(groups).forEach(g => {
            const avg = (key, list) => {
                const sum = list.reduce((a, b) => a + Number(b || 0), 0);
                return this.applyRounding(key, sum / list.length);
            };

            sheet.addRow([
                g.torch,
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
                avg('Heat', g.items.map(i => i['Heat']))
            ]);
        });
        sheet.getRow(1).font = { bold: true };
    }
}

module.exports = ActualDataExtractor;