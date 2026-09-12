// Invoked only by the user's pnpm dev command. Never terminates listeners.
import net from 'node:net';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const apiPort = Number(process.env.API_PORT || 4100);
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  console.error('API_PORT must be an integer between 1 and 65535 in .env.');
  process.exit(1);
}
const targets = [
  { name: 'web', host: '127.0.0.1', port: 5173 },
  { name: 'API', host: process.env.API_HOST || '127.0.0.1', port: apiPort },
];
let failed = false;
for (const target of targets) {
  const error = await new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', resolve);
    server.listen(
      { host: target.host, port: target.port, exclusive: true },
      () => {
        server.close(() => resolve(null));
      },
    );
  });
  if (!error) continue;
  failed = true;
  if (error.code === 'EADDRINUSE') {
    console.error(
      `${target.name} port ${target.port} is already occupied. An earlier pnpm dev session may still be running.`,
    );
    console.error(
      `Reuse that app, or press Ctrl-C in its terminal before starting a second session. Inspect with: lsof -nP -iTCP:${target.port} -sTCP:LISTEN`,
    );
  } else {
    console.error(
      `Cannot bind ${target.name} to ${target.host}:${target.port}: ${error.message}`,
    );
  }
}
if (failed) {
  console.error(
    'Development startup cancelled before building. No existing processes were stopped.',
  );
  process.exit(1);
}
