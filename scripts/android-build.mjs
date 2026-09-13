import {
  cp,
  mkdir,
  readFile,
  writeFile,
  access,
  readdir,
} from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url));
const tools = path.join(root, 'artifacts/android-tools');
const envFile = JSON.parse(
  await readFile(path.join(tools, 'environment.json'), 'utf8'),
);
const config = JSON.parse(
  await readFile(path.join(root, 'android/runtime-config.json'), 'utf8'),
);
if (!['offline', 'connected'].includes(config.mode))
  throw new Error('Invalid Android mode');
if (
  Object.keys(config).some((key) => !['mode', 'webUrl', 'apiUrl'].includes(key))
)
  throw new Error(
    'Android config supports only mode, webUrl and apiUrl. Keep credentials on the server.',
  );
if (config.mode === 'connected')
  for (const field of ['webUrl', 'apiUrl']) {
    const url = new URL(config[field]);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      url.hostname === 'appassets.androidplatform.net'
    )
      throw new Error(
        `Invalid ${field}: use a remote HTTPS origin without credentials/path/query/fragment`,
      );
    config[field] = url.origin;
  }
const web = path.join(root, 'artifacts/android-web');
await access(path.join(web, 'index.html'));
const offlineBuild = JSON.parse(
  await readFile(path.join(web, 'offline-build.json'), 'utf8'),
);
if (offlineBuild.mode !== 'offline')
  throw new Error(
    'Run pnpm android:web before packaging. The embedded fallback must be an offline build.',
  );
const assets = path.join(root, 'android/app/src/main/assets');
await mkdir(assets, { recursive: true });
// Remove only generated assets so stale web bundles cannot remain in the APK.
const { rm } = await import('node:fs/promises');
await rm(path.join(assets, 'web'), { recursive: true, force: true });
await cp(web, path.join(assets, 'web'), { recursive: true });
const bundleHash = createHash('sha256');
async function hashTree(dir, relative = '') {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) await hashTree(path.join(dir, entry.name), name);
    else {
      bundleHash.update(name);
      bundleHash.update(await readFile(path.join(dir, entry.name)));
    }
  }
}
await hashTree(path.join(assets, 'web'));
const webBundleSha256 = bundleHash.digest('hex');
await writeFile(path.join(assets, 'build-identity.txt'), webBundleSha256);
await writeFile(
  path.join(assets, 'runtime-config.json'),
  JSON.stringify(config),
);
await writeFile(
  path.join(root, 'android/local.properties'),
  `sdk.dir=${envFile.ANDROID_HOME}\n`,
);
await new Promise((resolve, reject) => {
  const child = spawn(
    path.join(tools, 'gradle-8.13/bin/gradle'),
    ['--no-daemon', '--console=plain', ':app:assembleDebug'],
    {
      cwd: path.join(root, 'android'),
      stdio: 'inherit',
      env: {
        ...process.env,
        ...envFile,
        GRADLE_USER_HOME: path.join(tools, 'gradle-cache'),
      },
    },
  );
  child.on('error', reject);
  child.on('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`Android build exited ${code}`)),
  );
});
const output = path.join(root, 'artifacts/android');
await mkdir(output, { recursive: true });
const destination = path.join(output, 'fingent360-debug.apk');
await cp(
  path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'),
  destination,
);
const apk = await readFile(destination);
const metadata = {
  file: destination,
  sha256: createHash('sha256').update(apk).digest('hex'),
  bytes: apk.length,
  webBundleSha256,
  builtAt: new Date().toISOString(),
  mode: config.mode,
  applicationId: 'com.fingent360.app',
  versionCode: 4,
  versionName: '0.3.1-feedback',
  minSdk: 26,
  debugSigned: true,
};
await writeFile(
  path.join(output, 'build.json'),
  JSON.stringify(metadata, null, 2) + '\n',
);
console.log(JSON.stringify(metadata, null, 2));
