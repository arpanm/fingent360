import { availablePort, run, updateLocalEnv } from './local-ports.mjs';
import { ensureDatabases } from './local-db.mjs';
try {
  const preview = process.argv.includes('--preview');
  const env = await ensureDatabases();
  await run('pnpm',['build'],{...process.env,...env});
  const api = await availablePort(env.API_PORT || 4100,env.API_HOST || '127.0.0.1');
  const web = await availablePort(preview ? (env.PREVIEW_PORT || 4173) : (env.WEB_PORT || 5173),'127.0.0.1',new Set([api]));
  const selected = {API_PORT:String(api),WEB_PORT:String(web),WEB_ORIGIN:`http://127.0.0.1:${web}`, ...(preview ? {PREVIEW_PORT:String(web)} : {})};
  await updateLocalEnv(selected);
  console.log(`Web: ${selected.WEB_ORIGIN}\nAPI: http://127.0.0.1:${api}\nProxy, account Origin checks, migrations and newly opened test runners use .env. Existing sessions are left running.`);
  await run('pnpm',['exec','concurrently','--kill-others','-n','contracts,api,web','pnpm --filter @fingent360/contracts dev','pnpm --filter @fingent360/api dev',preview ? 'pnpm --filter @fingent360/web preview' : 'pnpm --filter @fingent360/web dev'],{...process.env,...env,...selected});
} catch (error) { console.error(error.message); process.exitCode = 1; }
