import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const appRoot = resolve(import.meta.dirname, '..');
const androidRoot = join(appRoot, 'android');
const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  join(homedir(), 'Library', 'Android', 'sdk'),
  '/Users/mose/.local/opt/android-sdk',
].filter(Boolean);
const sdkPath = sdkCandidates.find((candidate) => existsSync(join(candidate, 'platforms', 'android-35')));

if (!sdkPath) {
  console.error('Android SDK 35 not found. Set ANDROID_HOME or ANDROID_SDK_ROOT before building the APK.');
  process.exit(1);
}

const result = spawnSync(join(androidRoot, 'gradlew'), ['assembleDebug', '--console=plain'], {
  cwd: androidRoot,
  env: { ...process.env, ANDROID_HOME: sdkPath, ANDROID_SDK_ROOT: sdkPath },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
