import { createApp } from './app.js';
import { readConfig } from './config.js';
const config = readConfig(process.env);
const app = await createApp(config);
await app.listen(config.API_PORT, config.API_HOST);
