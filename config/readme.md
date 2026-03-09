# Automation Configuration Guide

## 🎛️ Flow Control (New)
Use the `flowControl` object in `Combinations.json` to toggle specific steps of the automation pipeline on or off. This is useful for debugging specific sections without running the full suite.

```json
"flowControl": {
  "cleanExports": true,       // Cleans 'exports' folder before run
  "checkSourceFile": true,    // Validates input file existence
  "runExtraction": true,      // Generates ActualData Excel from .txt
  "login": true,              // Performs Login
  "createProject": true,      // Creates Project in UI
  "deviceRegistration": true, // Runs Device Registration (Step 1)
  "setup": true,              // Configures Pipes/WPS in Setup tab
  "deviceSync": true,         // Runs Device Sync (Step 2)
  "productionAnalysis": true, // Analyzes Production Data
  "comparison": true          // Runs Excel Comparison
}
```

## 📱 Device Registration Configuration
Configure the external executables for device simulation.

- **step1**: Handles the initial device registration to capture the Device ID.
- **step2**: Handles the database synchronization. Supports multiple file sets.

## 📂 Project Structure Updates

### Locators
Locators have been moved out of Page Objects and into the `Locators/` directory for better maintainability.
- `Locators/LoginPageLocators.page.js`
- `Locators/CreateProjectLocators.page.js`
- `Locators/SetupLocators.page.js`
- `Locators/StatusConfigLocators.page.js`
- `Locators/ProductionTabLocators.page.js`
- `Locators/DeviceAssigningLocators.page.js`
- `Locators/SpecificationsLocators.page.js`

### Helpers
Common logic shared across tests is now in `Helper/CommonHelper.js`.

### Exports
Output files are organized into:
- `exports/ActualData/`: Data extracted from BoltDB text files.
- `exports/ProductionData/`: Data scraped from the Web UI.
- `exports/ComparedData/`: Final comparison reports.

---

| Mode          | Description                                                      |
| ------------- | ---------------------------------------------------------------- |
| singleProject | Runs one project in one browser                                  |
| multiProject  | Runs multiple projects/weld sets in parallel                     |
| multiBrowser  | Runs same project across multiple browsers with different slopes |

### 1. Execution Mode (`mode`)
Determines how the test suite runs.
- **"single"**: Runs the project defined in `singleProject`.
- **"multiProject"**: Runs multiple projects defined in the `multiProject` array (Sequential/Parallel depending on test config).
- **"multiBrowser"**: Runs the same project across multiple browsers with different parameters (defined in `multiBrowser` array).

| Field | Meaning               |
| ----- | --------------------- |
| view  | Extract main tab data |
| tlogs | Extract TLogs data    |

### 3. Single Project Configuration (`singleProject`)
Used when `mode` is set to `"single"`.
- **projectName**: Exact name of the project to Create/Open.
- **sourceFile**: Name of the text file in the `Input/` folder (e.g., `bolt_2CW.txt`).
- **weldIds**: Comma-separated string of Weld IDs to filter (e.g., `"123, 124"`). Leave empty `""` to process ALL welds.
- **slopeCombinations**: Array of slope settings to iterate through.
  ```json
  "slopeCombinations": [
    { "slopeIn": 0, "slopeOut": 0 },
    { "slopeIn": 5, "slopeOut": 5 }
  ]
  ```
- **setupConfig**: Defines the Pipe and WPS details for the Setup tab.
  - **pipes**: Array of pipe definitions.
    - **pipeSize**, **wallThickness**, **pipeCount**, **pipeLength**: Numeric strings.
    - **manufacturer**: Array of strings (searches and selects each).
    - **wps**: Array of strings (enters the first one).

### 4. Multi-Project Configuration (`multiProject`)
Array of project objects. Each object follows the same structure as `singleProject` but includes a `browserId` for parallel execution tracking.

| Field             | Description                                |
| ----------------- | ------------------------------------------ |
| projectName       | Name of the project                        |
| weldIds           | Manual weld IDs (comma-separated or empty) |
| slopeCombinations | Slope configurations                       |


Multi project / Multi browser

| Field             | Description                  |
| ----------------- | ---------------------------- |
| browserId         | Unique browser instance      |
| projectName       | Project name                 |
| sourceFile        | File containing weld data    |
| weldIds           | Specific weld IDs to process |
| slopeCombinations | Slope combinations           |


RUN command:
npx playwright test



                    Read config.json
                            │
                            ▼
                    Check "mode"
                            │
     ┌──────────────────────┼──────────────────────┐
     ▼                      ▼                      ▼
singleProject          multiProject           multiBrowser
     │                      │                      │
Run Single           Loop Each Project        Loop Each Browser
Browser              Object (browserId)       Object
     │                      │                      │
Process Weld IDs     Launch Parallel         Launch Parallel
                     Browser Instances       Browser Instances


Open Weld
   │
   ├── Pass.view === true  → Extract Pass Data
   │
   ├── Zone.view === true  → Extract Zone Data
   │
   ├── Tilt.view === true  → Extract Tilt Data
   │
   ├── Pass.tlogs === true → Extract Pass TLogs
   │
   ├── Zone.tlogs === true → Extract Zone TLogs
   │
   └── Tilt.tlogs === true → Extract Tilt TLogs                     
