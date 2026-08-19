import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
try {
  require.resolve('playwright-core');
  require.resolve('@sparticuz/chromium');
  console.log('shot libs present');
} catch {
  console.log('installing shot libs');
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: import.meta.dirname, stdio: 'inherit' });
  process.exit(r.status || 0);
}
