// User-owned generation/build preparation only. Never invoked during agent authoring.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateIosConfig, project } from '../ios/project.mjs';
const root = fileURLToPath(new URL('..', import.meta.url)),
  out = new URL('../artifacts/ios-preview/', import.meta.url);
const config = validateIosConfig(
  JSON.parse(
    await readFile(
      new URL('../ios/runtime-config.json', import.meta.url),
      'utf8',
    ),
  ),
);
const run = (args, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { cwd: root, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(Error(`pnpm exited ${code}`)),
    );
  });
await run(['--filter', '@fingent360/contracts', 'build']);
await run(
  [
    '--filter',
    '@fingent360/web',
    'build',
    '--outDir',
    '../../artifacts/ios-preview/web',
    '--emptyOutDir',
  ],
  { ...process.env, VITE_APP_RUNTIME: 'offline' },
);
await mkdir(new URL('Fingent360.xcodeproj/', out), { recursive: true });
for (const file of ['App.swift', 'FeedbackBridge.swift', 'Info.plist'])
  await cp(
    new URL('../ios/Fingent360/' + file, import.meta.url),
    new URL(file, out),
  );
await cp(
  new URL('../ios/feedback-bridge.js', import.meta.url),
  new URL('feedback-bridge.js', out),
);
await writeFile(
  new URL('runtime-config.json', out),
  JSON.stringify(config, null, 2) + '\n',
);
await writeFile(new URL('Fingent360.xcodeproj/project.pbxproj', out), project);
const index = new URL('web/index.html', out),
  html = await readFile(index, 'utf8');
const entry =
  /<script\b[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/.exec(html);
if (!entry)
  throw Error('Built module entry layout changed; no bootstrap was installed.');
const bootstrap = await readFile(
  new URL('../ios/bootstrap.js', import.meta.url),
  'utf8',
);
await writeFile(
  new URL('web/ios-bootstrap.js', out),
  `window.__fingentEntry=${JSON.stringify(entry[1])};\n${bootstrap}`,
);
await writeFile(
  index,
  html
    .replace(entry[0], '')
    .replace('</body>', '<script src="/ios-bootstrap.js"></script></body>'),
);
console.log(
  'Prepared artifacts/ios-preview/Fingent360.xcodeproj. Open in Xcode, select a simulator or your signing team/device, and build manually. No IPA has been built or signed.',
);
