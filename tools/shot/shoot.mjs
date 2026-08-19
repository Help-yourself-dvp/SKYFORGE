import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../..');
const outDir = resolve(root, 'docs/screens');

const HOOKS = [
  'shot-title',
  'shot-world',
  'shot-build',
  'shot-vehicle',
  'shot-night',
  'shot-survival',
  'shot-pause',
];

function waitDbg(page, timeout = 25000) {
  return page.waitForFunction(() => window.__SKY && window.__SKY.dbg && window.__SKY.dbg.last, { timeout });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  let chromium;
  let playwright;
  try {
    chromium = require('@sparticuz/chromium');
    playwright = require('playwright-core');
  } catch (e) {
    console.warn('shot deps missing, skip', e.message);
    await writeFile(resolve(outDir, 'README.txt'), 'Install tools/shot deps to capture screens.\n');
    return;
  }
  const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4179'], {
    cwd: root,
    stdio: 'pipe',
  });
  await new Promise((res) => setTimeout(res, 1500));
  const browser = await playwright.chromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    for (const hook of HOOKS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto(`http://127.0.0.1:4179/#${hook}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      try {
        await waitDbg(page);
        await page.waitForTimeout(1200);
      } catch (e) {
        console.warn('dbg wait', hook, e.message);
        await page.waitForTimeout(2500);
      }
      await page.screenshot({ path: resolve(outDir, `${hook}.png`) });
      await page.close();
      console.log('shot', hook);
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
