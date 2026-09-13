import { readFile, mkdir, access, open } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)),
  tools = path.join(root, 'artifacts/android-tools');
const configured = JSON.parse(
  await readFile(path.join(tools, 'environment.json'), 'utf8'),
);
const emulatorHome = path.join(tools, 'emulator-user'),
  avds = path.join(tools, 'avd');
await mkdir(emulatorHome, { recursive: true });
await mkdir(avds, { recursive: true });
const env = {
  ...process.env,
  ...configured,
  ANDROID_USER_HOME: emulatorHome,
  ANDROID_EMULATOR_HOME: emulatorHome,
  ANDROID_AVD_HOME: avds,
  ANDROID_ADB_SERVER_PORT: '5039',
};
const run = (command, args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
    });
    if (input !== undefined) child.stdin.end(input);
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Native command failed: ${code}`)),
    );
  });
const sdk = configured.ANDROID_HOME;
const avd = path.join(avds, 'fingent360-test.avd');
try {
  await access(avd);
} catch {
  await run(
    path.join(sdk, 'cmdline-tools/latest/bin/avdmanager'),
    [
      'create',
      'avd',
      '--name',
      'fingent360-test',
      '--package',
      'system-images;android-35;google_apis;arm64-v8a',
      '--path',
      avd,
      '--device',
      'pixel_6',
    ],
    'no\n',
  );
}
await run(path.join(sdk, 'platform-tools/adb'), ['-P', '5039', 'start-server']);
const log = await open(path.join(tools, 'emulator.log'), 'a');
const child = spawn(
  path.join(sdk, 'emulator/emulator'),
  [
    '-avd',
    'fingent360-test',
    '-ports',
    '5580,5581',
    '-no-window',
    '-no-audio',
    '-no-snapshot-save',
    '-no-boot-anim',
    '-gpu',
    'swiftshader_indirect',
    '-memory',
    '2048',
  ],
  { env, detached: true, stdio: ['ignore', log.fd, log.fd] },
);
child.unref();
await log.close();
console.log(
  `Isolated emulator started PID ${child.pid}. Use adb -P 5039 -s emulator-5580. Log: artifacts/android-tools/emulator.log. This command does not install or reset app data.`,
);
