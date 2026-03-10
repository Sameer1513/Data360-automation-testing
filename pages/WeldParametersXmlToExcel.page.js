const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const ExcelJS = require('exceljs');

class WeldParametersXmlToExcel {

    constructor() {

        this.xmlPath = path.join(process.cwd(), 'test-data', 'WeldParameters.wpa.xml');

        this.exportDir = path.join(process.cwd(), 'exports');

        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }

        this.outputPath = path.join(this.exportDir, 'WeldParameters_XML.xlsx');
    }

    async run() {

        console.log("📥 Reading XML...");

        const xmlData = fs.readFileSync(this.xmlPath, 'utf8');

        const parser = new xml2js.Parser({
            explicitArray: false
        });

        const parsed = await parser.parseStringPromise(xmlData);

        const variables = parsed.crcEvansData.data.variable;

        //---------------------------------------
        // BUILD VARIABLE MAP
        //---------------------------------------

        const variableMap = {};

        for (const v of variables) {

            const name = v.$.internalName;

            if (!v.value) continue;

            const values = Array.isArray(v.value) ? v.value : [v.value];

            variableMap[name] = {};

            for (const val of values) {

                const group = val.$.groupName;
                const data = val.fileData;

                variableMap[name][group] = data;
            }
        }

        //---------------------------------------
        // GET GROUP LIST
        //---------------------------------------

        const groups = Object.keys(variableMap.PassNm);

        //---------------------------------------
        // CREATE EXCEL
        //---------------------------------------

        //---------------------------------------
// CREATE EXCEL
//---------------------------------------

const workbook = new ExcelJS.Workbook();


const leadSheet = workbook.addWorksheet("Lead Torch");
const trailSheet = workbook.addWorksheet("Trail Torch");

        const columns = [
            { header: "Pass", key: "pass", width: 20 },
            { header: "Zone", key: "zone", width: 10 },

            { header: "TravelSpeed High", key: "tvHigh", width: 18 },
            { header: "TravelSpeed Low", key: "tvLow", width: 18 },

            { header: "OscWidth High", key: "oscHigh", width: 18 },
            { header: "OscWidth Low", key: "oscLow", width: 18 },

            { header: "Voltage High", key: "voltHigh", width: 18 },
            { header: "Voltage Low", key: "voltLow", width: 18 },

            { header: "Current High", key: "currHigh", width: 18 },
            { header: "Current Low", key: "currLow", width: 18 },

            { header: "WireSpeed High", key: "wireHigh", width: 18 },
            { header: "WireSpeed Low", key: "wireLow", width: 18 }
        ];

        leadSheet.columns = columns;
        trailSheet.columns = columns;

        //---------------------------------------
        // BUILD ROWS
        //---------------------------------------

        for (const group of groups) {

            const pass = variableMap.PassNm?.[group] || "";
            const zone = variableMap.PassPndtNm?.[group] || "";

            const row = {

                pass,
                zone,

                tvHigh: variableMap.TvSdHgL?.[group] || "",
                tvLow: variableMap.TvSdLoL?.[group] || "",

                oscHigh: variableMap.OscWtHgL?.[group] || "",
                oscLow: variableMap.OscWtLoL?.[group] || "",

                voltHigh: variableMap.VTgVHgL?.[group] || "",
                voltLow: variableMap.VTgVLoL?.[group] || "",

                currHigh: variableMap.VTgAHgL?.[group] || "",
                currLow: variableMap.VTgALoL?.[group] || "",

                wireHigh: variableMap.TPSiWFSdHgL?.[group] || "",
                wireLow: variableMap.TPSiWFSdLoL?.[group] || ""
            };

            //---------------------------------------
            // SPLIT INTO LEAD / TRAIL
            //---------------------------------------

            if (group.endsWith('A')) {
                leadSheet.addRow(row);
            } else {
                trailSheet.addRow(row);
            }
        }

        //---------------------------------------
        // SAVE FILE
        //---------------------------------------

        await workbook.xlsx.writeFile(this.outputPath);

        console.log(`✅ XML Converted to Excel → ${this.outputPath}`);

        return this.outputPath;
    }
}

module.exports = WeldParametersXmlToExcel;