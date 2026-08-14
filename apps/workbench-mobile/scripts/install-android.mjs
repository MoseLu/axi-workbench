import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const appRoot = resolve(import.meta.dirname, '..');
const apk = resolve(appRoot, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (!existsSync(apk)) {
  console.error(`APK not found: ${apk}`);
  process.exit(1);
}

const devices = spawnSync('adb', ['devices'], { encoding: 'utf8' });
if (devices.error) throw devices.error;
const candidates = devices.stdout
  .split('\n')
  .slice(1)
  .map((line) => line.trim().split(/\s+/u))
  .filter(([serial, state]) => serial && state === 'device')
  .map(([serial]) => serial);
const serial = process.env.ANDROID_SERIAL || candidates.find((value) => value.startsWith('emulator-'));
if (!serial) {
  console.error('No Android emulator is connected. Start an AVD or set ANDROID_SERIAL.');
  process.exit(1);
}

const result = spawnSync('adb', ['-s', serial, 'install', '-r', apk], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
