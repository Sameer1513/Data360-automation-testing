const assertionHelper = require('../Helper/AssertionHelper');

function extractDesktopId(output) {
  if (!output) return '';
  const m = output.match(/DESKTOP-[A-Z0-9-]+/i);
  return m ? m[0] : '';
}

function isDeviceRegisterCompleted(output) {
  if (!output) return false;
  // device_register.js prints both of these lines (depending on where the ID is captured/serialized)
  return /🎯 ID (Captured|Saved to config)/i.test(output) || /✅ Step 1 completed successfully/i.test(output);
}

function isDataSyncCompleted(output) {
  if (!output) return false;
  // device_register.js resolves step2 when one of these completion signals appears.
  return (
    /✅ \[SYNC COMPLETE\]/i.test(output) ||
    /\(boltdb\) Get all logs:\s*Completed/i.test(output) ||
    /No new logs to publish/i.test(output) ||
    /Device registration and sync finished!/i.test(output)
  );
}

function truncate(s, max = 7000) {
  const str = s || '';
  if (str.length <= max) return str;
  return `${str.slice(0, max)}\n... (truncated) ...`;
}

class CreateDeviceRegisterAssignSyncAssertion {
  attach(testInfo, {
    caseId,
    step1Output,
    step2Runs,
    deviceAssignedProjects = null,
    createdProjectNames = null,
    requireDataSync = true
  }) {
    const deviceId = extractDesktopId(step1Output);
    const registerOk = isDeviceRegisterCompleted(step1Output);
    const step1Tail = truncate(step1Output, 900);

    const checks = [];
    checks.push({
      name: `${caseId} - device register step1`,
      expected: 'ID captured and written to config (capturedDeviceId)',
      actual: registerOk
        ? `PASS${deviceId ? ` | deviceId=${deviceId}` : ''}\nOutput (tail):\n${step1Tail}`
        : `FAIL marker not found\nOutput (tail):\n${step1Tail}`,
      pass: registerOk,
      detail: deviceId ? `Detected ${deviceId}` : 'No DESKTOP-* id found'
    });

    // Optional: validate device assigned projects state.
    if (Array.isArray(createdProjectNames) && createdProjectNames.length > 0 && Array.isArray(deviceAssignedProjects)) {
      const allAssigned = createdProjectNames.every(p => deviceAssignedProjects.includes(p));

      checks.push({
        name: `${caseId} - device assignment to projects`,
        expected: 'All created projects are assigned to this device',
        actual: `Device shows (${deviceAssignedProjects.length}): ${deviceAssignedProjects.join(', ') || '-'} | allAssigned=${allAssigned}`,
        pass: allAssigned,
        detail: `createdProjects=${createdProjectNames.join(', ')}`
      });
    }

    if (requireDataSync) {
      if (!Array.isArray(step2Runs) || step2Runs.length === 0) {
        checks.push({
          name: `${caseId} - data sync step2`,
          expected: 'SYNC complete signal present',
          actual: 'No step2 runs captured',
          pass: false,
          detail: '-'
        });
      } else {
        for (let i = 0; i < step2Runs.length; i++) {
          const run = step2Runs[i] || {};
          const ok = isDataSyncCompleted(run.output);
          const tail = truncate(run.output, 900);
          checks.push({
            name: `${caseId} - data sync step2 (run #${i + 1})`,
            expected: 'SYNC complete signal present',
            actual: ok
              ? `PASS${run.dbLabel ? ` | ${run.dbLabel}` : ''}\nOutput (tail):\n${tail}`
              : `FAIL${run.dbLabel ? ` | ${run.dbLabel}` : ''}\nOutput (tail):\n${tail}`,
            pass: ok,
            detail: run.dbLabel ? run.dbLabel : `step2 run #${i + 1}`
          });
        }
      }
    }

    return assertionHelper.attachStepSummary(`Device Register + Data Sync: ${caseId}`, checks, testInfo);
  }
}

module.exports = new CreateDeviceRegisterAssignSyncAssertion();
