/**
 * Cross-spec coordination: production-flow.spec.js Step 7 (device_register --step=2) is terminal-only.
 * create-device-register-assign-sync.spec.js waits on this file so it can start as soon as that terminal
 * work finishes — without waiting for BoltDB / UI / comparison in the rest of production-flow.
 */
const fs = require('fs');
const path = require('path');

const REL = path.join('playwright-report', '.production-flow-terminal-sync.done');

function getSignalPath() {
  return path.join(process.cwd(), REL);
}

function clearProductionFlowTerminalSyncGate() {
  const p = getSignalPath();
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {
    /* ignore */
  }
}

function markProductionFlowTerminalSyncDone() {
  const p = getSignalPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, String(Date.now()), 'utf-8');
  console.log(`\n✅ Production-flow terminal sync gate written → ${REL}`);
}

/**
 * Poll until production-flow Step 7 completes (or skip env).
 * @param {{ timeoutMs?: number, pollMs?: number }} opts
 */
function isProductionFlowSpecDisabledInFlowControl() {
  try {
    const p = path.join(process.cwd(), 'config', 'spec-flow-control.json');
    if (!fs.existsSync(p)) return false;
    const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return j['production-flow.spec.js'] === false;
  } catch (_) {
    return false;
  }
}

async function waitForProductionFlowTerminalSyncDone(opts = {}) {
  if (process.env.SKIP_PF_TERMINAL_GATE === '1' || process.env.SKIP_WAIT_FOR_PRODUCTION_FLOW_TERMINAL === '1') {
    console.log('⏭ SKIP_PF_TERMINAL_GATE / SKIP_WAIT_FOR_PRODUCTION_FLOW_TERMINAL — not waiting for production-flow terminal gate.');
    return;
  }

  if (isProductionFlowSpecDisabledInFlowControl()) {
    console.log('⏭ spec-flow-control.json has production-flow.spec.js: false — not waiting for terminal gate.');
    return;
  }

  const timeoutMs = opts.timeoutMs ?? 60 * 60 * 1000;
  const pollMs = opts.pollMs ?? 500;
  const p = getSignalPath();
  const start = Date.now();

  console.log(`⏳ Waiting for production-flow Step 7 terminal (device sync) → ${REL}`);

  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(p)) {
      console.log(`✅ Production-flow terminal gate found (${Math.round((Date.now() - start) / 1000)}s). Starting modular spec.`);
      return;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    `Timeout waiting for ${REL} (production-flow Step 7 terminal not completed within ${timeoutMs}ms). ` +
      'Run production-flow first, or set SKIP_PF_TERMINAL_GATE=1 to run modular alone.'
  );
}

module.exports = {
  getSignalPath,
  clearProductionFlowTerminalSyncGate,
  markProductionFlowTerminalSyncDone,
  waitForProductionFlowTerminalSyncDone,
};
