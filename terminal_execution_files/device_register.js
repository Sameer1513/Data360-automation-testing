const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load config
const configPath = path.join(__dirname, '../config/Combinations.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath));
} catch (error) {
  console.error(`❌ Failed to load config from ${configPath}: ${error.message}`);
  process.exit(1);
}

// Helper to resolve file paths (checks current dir and 'input' folders)
function resolveFile(fileName, description) {
  const searchPaths = [
    path.join(__dirname, fileName),
    path.join(__dirname, '../input', fileName),
    path.join(__dirname, 'input', fileName),
    path.resolve(fileName)
  ];

  for (const p of searchPaths) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(`❌ ASSERTION FAILED: ${description} '${fileName}' not found.\nChecked locations:\n${searchPaths.join('\n')}`);
}

// Helper: Find first file with specific extension in Input folders
function findFileByExtension(extension) {
  const searchDirs = [
    path.join(__dirname, '../input'),
    path.join(__dirname, 'input'),
    path.join(__dirname, '../Input'),
    path.join(__dirname, 'Input')
  ];

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const match = files.find(file => file.toLowerCase().endsWith(extension.toLowerCase()));
      if (match) return path.join(dir, match);
    }
  }
  return null;
}

function runStep1(exeName) {
  return new Promise((resolve, reject) => {
    let exePath;
    try {
      exePath = resolveFile(exeName, "Step 1 Executable");
    } catch (e) {
      return reject(e);
    }

    let capturedDeviceId = "";
    let outputBuffer = "";
    let killTimeout = null;

    console.log(`\n🚀 Step 1: Running ${exeName} (Press Enter if prompted)`);

    // FIX: Capture both stdout and stderr to ensure we don't miss the ID
    const cmd = exePath.includes(' ') ? `"${exePath}"` : exePath;
    const proc = spawn(cmd, [], {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'] 
    });

    const onData = (data) => {
      const output = data.toString();
      process.stdout.write(output); // Still show output in terminal
      outputBuffer += output; // Accumulate buffer to handle split chunks

      // REGEX FIX: Captures the 'DESKTOP-XXXXXXX' pattern (Case Insensitive, allows hyphens)
      const idMatch = outputBuffer.match(/DESKTOP-[A-Z0-9-]+/i);
      if (idMatch && !capturedDeviceId) {
        capturedDeviceId = idMatch[0];
        console.log(`\n🎯 ID Captured: ${capturedDeviceId}`);
        // Wait 5 seconds for the EXE to finish registration before killing
        console.log("⏳ Waiting 5 seconds for registration to complete...");
        killTimeout = setTimeout(() => {
          console.log(`\n🔪 Terminating process tree for PID: ${proc.pid}...`);
          // Use taskkill with /T flag to terminate the process and any child processes it may have spawned.
          // The default proc.kill() on Windows does not use /T, which can leave child processes running.
          exec(`taskkill /PID ${proc.pid} /F /T`, (err) => {
            if (err) {
              // This is not a critical error. It can fail if the process already exited on its own.
              console.warn(`[Debug] taskkill command may have failed (this is often ok): ${err.message}`);
            } else {
              console.log('✅ Process tree termination signal sent.');
            }
          });
        }, 5000);
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('exit', (code, signal) => {
      if (killTimeout) clearTimeout(killTimeout);
      // If we captured the ID, consider it a success even if killed
      if (capturedDeviceId) {
        console.log('✅ Step 1 completed successfully (ID Captured)');
        resolve(capturedDeviceId); // Return the ID
      } else {
        // If no ID captured, log the buffer for debugging
        console.log('--- DEBUG: Captured Output Start ---');
        console.log(outputBuffer);
        console.log('--- DEBUG: Captured Output End ---');

        if (code === 0) {
          console.warn('⚠️ Step 1 finished with code 0 but NO ID was captured.');
          resolve(""); 
        } else {
          reject(new Error(`❌ Step 1 failed with exit code ${code} / signal ${signal}`));
        }
      }
    });
  });
}

function runStep2(exeName, dbFile, paramFile) {
  return new Promise((resolve, reject) => {
    let exePath, dbPath, paramPath;
    try {
      exePath = resolveFile(exeName, "Step 2 Executable");
      dbPath = resolveFile(dbFile, "Database File");
      paramPath = resolveFile(paramFile, "Parameter File");
    } catch (e) {
      return reject(e);
    }

    // 1. PRE-CLEANUP: Kill any existing instances and delete files
    const exeBaseName = path.basename(exePath);
    const lockPath = dbPath + '.lock';
    
    try {
        // console.log(`🔪 Killing any existing ${exeBaseName} processes...`);
        execSync(`taskkill /F /IM "${exeBaseName}"`, { stdio: 'ignore' });
    } catch (e) {}

    try {
        // if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    } catch (e) { console.log(`⚠️ Cleanup warning: ${e.message}`); }

    console.log(`\n🚀 Step 2: Running ${exeName} -db ${dbFile} -param ${paramFile}`);

    // FIX: Use pipe to capture output, and detach so it can loop in the background
    const cmd = exePath.includes(' ') ? `"${exePath}"` : exePath;
    const proc = spawn(cmd, [`-db`, dbPath, `-param`, paramPath], {
      shell: true,
      detached: false, 
      stdio: ['ignore', 'pipe', 'pipe'] 
    });

    let isSynced = false;
    let outputBuffer = "";
    let idleCheckCount = 0;

    const cleanupAndExit = () => {
        try {
            execSync(`taskkill /PID ${proc.pid} /F /T`, { stdio: 'ignore' });
        } catch(e) {
            try { execSync(`taskkill /F /IM "${exeBaseName}"`, { stdio: 'ignore' }); } catch(ex) {}
        }
        
        // Delete files
        try {
            // if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
            if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
        } catch(e) {}
    };

    const onData = (data) => {
      const output = data.toString();
      process.stdout.write(output); // Mirror output to Playwright console
      outputBuffer += output;

      // 🛠️ LOGIC UPDATE: Reset idle count if data records are flowing
      if (output.includes('"Record":"T"') || output.includes('"Record":"C"') || output.includes('"Record":"S"')) {
        idleCheckCount = 0;
      } else {
        // Only count idle status messages if NO data records are in this chunk
        if (output.includes("( mqtt ) Status: Publish Ready (Sub: Running, HB: Running, Pub: Running)")) {
          idleCheckCount++;
        }
      }

      // 🛠️ THE FIX: Scan for the exact success string OR sufficient MQTT heartbeats
      if (!isSynced && (outputBuffer.includes("No new logs to publish") || outputBuffer.includes("(boltdb) Get all logs: Completed") || idleCheckCount > 3)) {
        console.log(`\n✅ [SYNC COMPLETE] Detected completion signal. Terminating process...`);
        isSynced = true;
        
        cleanupAndExit();
        resolve(); // Tell the script to move on!
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('exit', code => {
      if (!isSynced) {
        cleanupAndExit();
        if (code === 0) resolve();
        else reject(new Error(`❌ ${exeName} failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  // Parse command line arguments for --step=X
  const args = process.argv.slice(2);
  const stepArg = args.find(arg => arg.startsWith('--step='));
  const targetStep = stepArg ? parseInt(stepArg.split('=')[1]) : 0; // 0 means run all

  try {
    // Access the specific section for device registration from Combinations.json
    const regConfig = config.deviceRegistration;

    if (!regConfig) {
      console.error("❌ ERROR: 'deviceRegistration' section missing in Combinations.json");
      process.exit(1);
    }

    // CHECK: Global Enable Flag
    if (regConfig.enabled === false) {
      console.log("ℹ️ Device Registration is explicitly disabled in config.");
      process.exit(0);
    }

    // Step 1: Device registration (optional, config-controlled)
    if ((targetStep === 0 || targetStep === 1) && regConfig && regConfig.step1.enabled) {
      // Handle 'executables' array from JSON or fallback to 'exe' string
      let exeName = regConfig.step1.exe || (regConfig.step1.executables && regConfig.step1.executables[0]);

      // 🔍 AUTO-DISCOVERY: EXE (Step 1)
      if (!exeName || exeName.trim() === "") {
        console.log("🔍 Step 1 Config 'exe' is empty. Searching for first .exe file in Input directory...");
        const foundExe = findFileByExtension('.exe');
        if (!foundExe) {
          throw new Error("❌ ASSERTION FAILED: No .exe file found in Input directory for Step 1.");
        }
        exeName = foundExe;
        console.log(`✅ Found EXE file: ${path.basename(exeName)}`);
      }

      const deviceID = await runStep1(exeName);

      if (deviceID) {
        // FIX: Save the ID into your JSON file so the Website can read it later
        const comboPath = path.join(__dirname, '../config/Combinations.json');
        
        if (fs.existsSync(comboPath)) {
          const comboData = JSON.parse(fs.readFileSync(comboPath, 'utf-8'));
          comboData.capturedDeviceId = deviceID;
          fs.writeFileSync(comboPath, JSON.stringify(comboData, null, 2));
          console.log(`🎯 ID Saved to config: ${deviceID}`);
        } else {
          console.warn(`⚠️ Combinations.json not found at: ${comboPath}`);
        }
      } else {
        console.warn("⚠️ No Device ID captured in Step 1. Skipping config update.");
      }
    }

    // Step 2: Sync / registration process for files
    const dbFilesToDelete = [];
    if ((targetStep === 0 || targetStep === 2) && regConfig && regConfig.step2 && regConfig.step2.enabled) {
      if (Array.isArray(regConfig.step2.files)) {
        console.log(`🔄 Processing ${regConfig.step2.files.length} sync configuration(s)...`);
        for (const fileObj of regConfig.step2.files) {
          let exeTarget = fileObj.exe;
          let dbTarget = fileObj.db;
          let paramTarget = fileObj.param;

          // 🔍 AUTO-DISCOVERY: EXE (Step 2)
          if (!exeTarget || exeTarget.trim() === "") {
            console.log("🔍 Config 'exe' is empty. Searching for first .exe file...");
            const foundExe = findFileByExtension('.exe');
            if (!foundExe) {
              throw new Error("❌ ASSERTION FAILED: No .exe file found in Input directory.");
            }
            exeTarget = foundExe;
            console.log(`✅ Found EXE file: ${path.basename(exeTarget)}`);
          }

          // 🔍 AUTO-DISCOVERY: DB
          if (!dbTarget || dbTarget.trim() === "") {
            console.log("🔍 Config 'db' is empty. Searching for first .db file in Input directory...");
            const foundDb = findFileByExtension('.db');
            
            if (!foundDb) {
              throw new Error("❌ ASSERTION FAILED: No .db file found in Input directory, and none specified in config.");
            }
            dbTarget = foundDb;
            console.log(`✅ Found DB file: ${path.basename(dbTarget)}`);
          }

          // Track DB file for cleanup
          try {
            const resolvedDb = resolveFile(dbTarget, "Database File");
            if (!dbFilesToDelete.includes(resolvedDb)) {
              dbFilesToDelete.push(resolvedDb);
            }
          } catch (e) { /* Ignore, runStep2 will fail if file missing */ }

          // 🔍 AUTO-DISCOVERY: PARAM (.csv or .xml)
          if (!paramTarget || paramTarget.trim() === "") {
            console.log("🔍 Config 'param' is empty. Searching for .csv or .xml file...");
            let foundParam = findFileByExtension('.csv');
            if (!foundParam) {
              foundParam = findFileByExtension('.xml');
            }
            
            if (!foundParam) {
              throw new Error("❌ ASSERTION FAILED: No .csv or .xml parameter file found in Input directory.");
            }
            paramTarget = foundParam;
            console.log(`✅ Found Param file: ${path.basename(paramTarget)}`);
          }

          await runStep2(exeTarget, dbTarget, paramTarget);
        }
      } else {
        console.warn("⚠️ 'step2.files' is not an array. Skipping Step 2.");
      }
    } else {
      console.log('ℹ Step 2 skipped (disabled in config)');
    }

    // Cleanup .db and .db.lock files
    if (dbFilesToDelete.length > 0) {
      console.log('\n🧹 Cleaning up database files...');
      for (const dbPath of dbFilesToDelete) {
        const lockPath = dbPath + '.lock';
        try {
          if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
            console.log(`✅ Deleted: ${path.basename(lockPath)}`);
          }
        } catch (err) { /* Ignore lock deletion errors */ }
      }
    }

    console.log('\n🎉 Device registration and sync finished!');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();