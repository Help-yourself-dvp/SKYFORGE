// Soak test: load the game in headless Chromium and watch for freezes/runaway growth.
// Usage: node tools/shot/soak.mjs [seconds] [hook]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../..');
const DURATION = Number(process.argv[2] || 70);
const HOOK = process.argv[3] || 'shot-world';

let chromium;
let playwright;
try {
  chromium = require('@sparticuz/chromium');
  playwright = require('playwright-core');
} catch (e) {
  console.error('shot deps missing', e.message);
  process.exit(1);
}

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4181'], {
  cwd: root,
  stdio: 'pipe',
});
await new Promise((res) => setTimeout(res, 2000));

const browser = await playwright.chromium.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath(),
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleMsgs = [];
page.on('console', (m) => {
  const t = m.text();
  consoleMsgs.push(t);
  if (t.startsWith('[DBG]')) process.stdout.write(`  ${t}\n`);
  if (m.type() === 'error') console.error(`  [PAGE ERROR] ${t}`);
});
page.on('pageerror', (e) => console.error(`  [PAGE EXC] ${e.message}`));

await page.goto(`http://127.0.0.1:4181/#${HOOK}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__SKY && window.__SKY.dbg && window.__SKY.dbg.last, { timeout: 25000 }).catch(() => console.warn('dbg never appeared'));

console.log(`soak ${DURATION}s hook=${HOOK}`);
const samples = [];
const t0 = Date.now();
let frozen = false;
let lastOk = Date.now();
while (Date.now() - t0 < DURATION * 1000) {
  const t = Date.now() - t0;
  try {
    const diag = await Promise.race([
      page.evaluate(() => {
        if (!window.__SKY) return null;
        const d = window.__SKY.game.getDiagnostics();
        return d ? { ...d, jsHeap: performance.memory ? performance.memory.usedJSHeapSize : null } : null;
      }),
      new Promise((res) => setTimeout(() => res('TIMEOUT'), 4000)),
    ]);
    if (diag === 'TIMEOUT' || diag === null) {
      const blockedMs = Date.now() - lastOk;
      console.log(`  t=${(t / 1000).toFixed(0)}s  *** MAIN THREAD BLOCKED (${blockedMs}ms) ***`);
      if (blockedMs > 6000) frozen = true;
    } else {
      lastOk = Date.now();
      samples.push(diag);
      const growth = samples.length > 1 && samples[samples.length - 1];
      console.log(
        `  t=${diag.t}s fps=${diag.fps} frame=${diag.frame} state=${diag.state} bodies=${diag.bodies} joints=${diag.joints} ` +
        `obj=${diag.threeObjects} dc=${diag.drawCalls} tris=${diag.triangles} part=${diag.particles} animals=${diag.animals} plants=${diag.plants} audio=${diag.audioNodes} heap=${diag.jsHeap ? Math.round(diag.jsHeap / 1048576) : '?'}MB${growth ? '' : ''}`,
      );
    }
  } catch (e) {
    console.log(`  t=${(t / 1000).toFixed(0)}s eval failed: ${e.message}`);
  }
  await new Promise((res) => setTimeout(res, 1000));
}

console.log('\n--- growth check (first vs last) ---');
if (samples.length >= 2) {
  const a = samples[0];
  const b = samples[samples.length - 1];
  for (const k of ['bodies', 'joints', 'threeObjects', 'drawCalls', 'triangles', 'particles', 'animals', 'plants', 'audioNodes']) {
    console.log(`  ${k}: ${a[k]} -> ${b[k]}  ${b[k] - a[k] > 0 ? '(GROWING)' : b[k] - a[k] < 0 ? '(shrinking)' : '(flat)'}`);
  }
}
console.log(`\nFROZEN: ${frozen}`);
console.log('console messages:', consoleMsgs.length);

await browser.close();
server.kill('SIGTERM');
process.exit(frozen ? 2 : 0);
