import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const version = readFileSync(resolve(root, 'version.txt'), 'utf8').trim();

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status || 1);
}

console.log(`SKYFORGE ${version} android:build`);
run('npm', ['run', 'build']);
run('npx', ['cap', 'sync', 'android']);
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
if (!existsSync(resolve(root, 'android', 'gradlew')) && !existsSync(resolve(root, 'android', 'gradlew.bat'))) {
  console.error('android/gradlew missing');
  process.exit(1);
}
run(gradlew, ['assembleRelease'], resolve(root, 'android'));
console.log('APK at android/app/build/outputs/apk/release/');
