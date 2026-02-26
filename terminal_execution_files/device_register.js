const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load config
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath));

let capturedDeviceId = ""; 

function runStep1(exeName) {
  return new Promise((resolve, reject) => {
    const exePath = path.join(__dirname, exeName);
    console.log(`\n🚀 Step 1: Running ${exeName} (Press Enter if prompted)`);

    // FIX: Changed stdio to 'pipe' for stdout so we can catch the ID
    const proc = spawn(`"${exePath}"`, [], {
      shell: true,
      stdio: ['inherit', 'pipe', 'inherit'] 
    });

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output); // Still show output in terminal

      // REGEX FIX: Captures the 'DESKTOP-XXXXXXX' pattern
      const idMatch = output.match(/DESKTOP-[A-Z0-9]+/);
      if (idMatch) {
        capturedDeviceId = idMatch[0];
        console.log(`\n🎯 ID Captured: ${capturedDeviceId}`);
      }
    });

    proc.on('exit', code => {
      if (code === 0) {
        console.log('✅ Step 1 completed successfully');
        resolve(capturedDeviceId); // Return the ID
      } else {
        reject(new Error(`❌ Step 1 failed with exit code ${code}`));
      }
    });
  });
}

function runStep2(exeName, dbFile, paramFile) {
  return new Promise((resolve, reject) => {
    const exePath = path.join(__dirname, exeName);
    const dbPath = path.join(__dirname, dbFile);
    const paramPath = path.join(__dirname, paramFile);

    console.log(`\n🚀 Step 2: Running ${exeName} -db ${dbFile} -param ${paramFile}`);

    const proc = spawn(`"${exePath}"`, [`-db`, `"${dbPath}"`, `-param`, `"${paramPath}"`], {
      shell: true,
      stdio: 'inherit'
    });

    proc.on('exit', code => {
      if (code === 0) {
        console.log(`✅ ${exeName} finished for ${paramFile}`);
        resolve();
      } else {
        reject(new Error(`❌ ${exeName} failed for ${paramFile} with exit code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    // Step 1: Device registration (optional, config-controlled)
    // REPLACE your current Step 1 block in main() with this:
if (config.step1.enabled) {
    const deviceID = await runStep1(config.step1.exe);
    
    // FIX: Save the ID into your JSON file so the Website can read it later
    const comboPath = path.join(__dirname, '../config/Combinations.json');
    const comboData = JSON.parse(fs.readFileSync(comboPath, 'utf-8'));
    comboData.capturedDeviceId = deviceID; 
    fs.writeFileSync(comboPath, JSON.stringify(comboData, null, 2));
    
    console.log(`🎯 ID Saved to config: ${deviceID}`);
}

    // Step 2: Sync / registration process for files
    if (config.step2.enabled) {
      for (const fileObj of config.step2.files) {
        await runStep2(fileObj.exe, fileObj.db, fileObj.param);
      }
    } else {
      console.log('ℹ Step 2 skipped (disabled in config)');
    }

    console.log('\n🎉 Device registration and sync finished!');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();