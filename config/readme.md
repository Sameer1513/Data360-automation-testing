A configurable Playwright + Node.js automation framework for extracting and analyzing weld production data.

This framework supports:

✅ Pass Tab Extraction

✅ Zone Tab Extraction

✅ Tilt Tab Extraction

✅ Optional TLogs Processing

✅ Single Project Execution

✅ Multi Project Execution

✅ Multi Browser Parallel Execution

All execution is controlled using a single config.json file.

| Mode          | Description                                                      |
| ------------- | ---------------------------------------------------------------- |
| singleProject | Runs one project in one browser                                  |
| multiProject  | Runs multiple projects/weld sets in parallel                     |
| multiBrowser  | Runs same project across multiple browsers with different slopes |


| Field | Meaning               |
| ----- | --------------------- |
| view  | Extract main tab data |
| tlogs | Extract TLogs data    |


Single project

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