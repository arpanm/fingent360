import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'darwin' || process.arch !== 'arm64')
  throw new Error(
    'This isolated setup is pinned to macOS ARM64. Supply an equivalent local SDK/JDK environment on other hosts.',
  );
const root = fileURLToPath(new URL('..', import.meta.url)),
  tools = path.join(root, 'artifacts/android-tools');
await mkdir(tools, { recursive: true });
const archives = [
  [
    'jdk.tar.gz',
    'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_aarch64_mac_hotspot_17.0.20.1_1.tar.gz',
    '196d13ba5f10414bef7f6a05a9b3f00edacb18ebacef2b99485db9e2ee18f0e8',
  ],
  [
    'gradle.zip',
    'https://services.gradle.org/distributions/gradle-8.13-bin.zip',
    '20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78',
  ],
  [
    'sdk.zip',
    'https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip',
    '835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e',
  ],
];
const run = (cmd, args, env = process.env, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env,
      stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
    });
    if (input !== undefined) child.stdin.end(input);
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
for (const [name, url, checksum] of archives) {
  const file = path.join(tools, name);
  try {
    await access(file);
  } catch {
    await run('curl', ['-fL', '--retry', '2', url, '-o', file]);
  }
  if (
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex') !== checksum
  )
    throw new Error(`Checksum mismatch for ${name}; archive not extracted.`);
}
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};
const java = path.join(tools, 'jdk-17.0.20.1+1/Contents/Home'),
  sdk = path.join(tools, 'sdk');
if (!(await exists(java)))
  await run('tar', ['-xzf', path.join(tools, 'jdk.tar.gz'), '-C', tools]);
if (!(await exists(path.join(tools, 'gradle-8.13'))))
  await run('unzip', ['-q', path.join(tools, 'gradle.zip'), '-d', tools]);
if (!(await exists(path.join(sdk, 'cmdline-tools/latest')))) {
  const dir = path.join(sdk, 'cmdline-tools');
  await mkdir(dir, { recursive: true });
  await run('unzip', ['-q', path.join(tools, 'sdk.zip'), '-d', dir]);
  const { rename } = await import('node:fs/promises');
  await rename(path.join(dir, 'cmdline-tools'), path.join(dir, 'latest'));
}
const environment = {
  JAVA_HOME: java,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
};
await writeFile(
  path.join(tools, 'environment.json'),
  JSON.stringify(environment, null, 2) + '\n',
);
console.log(
  'Review and accept the Android SDK package licenses in the following native installer prompts.',
);
await run(
  path.join(sdk, 'cmdline-tools/latest/bin/sdkmanager'),
  ['platforms;android-35', 'build-tools;35.0.0', 'platform-tools'],
  { ...process.env, ...environment },
);
console.log(
  'Isolated Android toolchain prepared. Build final web assets before node scripts/android-build.mjs.',
);
