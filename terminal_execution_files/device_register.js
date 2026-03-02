const { spawn } = require('child_process');
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
    const proc = spawn(exePath, [], {
      shell: false,
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
          proc.kill();
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

    console.log(`\n🚀 Step 2: Running ${exeName} -db ${dbFile} -param ${paramFile}`);

    // FIX: Use pipe to capture output, and detach so it can loop in the background
    const proc = spawn(exePath, [`-db`, dbPath, `-param`, paramPath], {
      shell: false,
      detached: true, 
      stdio: ['ignore', 'pipe', 'pipe'] 
    });

    let isSynced = false;
    let outputBuffer = "";

    const onData = (data) => {
      const output = data.toString();
      process.stdout.write(output); // Mirror output to Playwright console
      outputBuffer += output;

      // 🛠️ THE FIX: Scan for the exact success string
      if (!isSynced && outputBuffer.includes("No new logs to publish")) {
        console.log(`\n✅ [SYNC COMPLETE] Detected 'No new logs to publish'. Proceeding to UI validation...`);
        isSynced = true;
        
        // Detach the process from Node's event loop so Node can exit
        proc.unref();
        
        // Stop listening to stdout so we don't hold the process open
        proc.stdout.removeAllListeners('data');
        proc.stderr.removeAllListeners('data');
        
        resolve(); // Tell the script to move on!
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('exit', code => {
      if (!isSynced) {
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

    // Step 1: Device registration (optional, config-controlled)
    if ((targetStep === 0 || targetStep === 1) && regConfig && regConfig.step1.enabled) {
      // Handle 'executables' array from JSON or fallback to 'exe' string
      const exeName = regConfig.step1.exe || (regConfig.step1.executables && regConfig.step1.executables[0]);
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
    if ((targetStep === 0 || targetStep === 2) && regConfig && regConfig.step2.enabled) {
      for (const fileObj of regConfig.step2.files) {
        await runStep2(fileObj.exe, fileObj.db, fileObj.param);
      }
    } else {
      console.log('ℹ Step 2 skipped (disabled in config)');
    }

    console.log('\n🎉 Device registration and sync finished!');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();