import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDist = path.join(root, 'web', 'dist');
const port = Number(process.env.PORT ?? 3000);

const app = await createApp({
  dataDir: process.env.DATA_DIR ?? path.join(root, 'data'),
  sampleDir: path.join(root, 'assets', 'sample'),
  webDist: existsSync(webDist) ? webDist : undefined,
});

app.listen(port, () => {
  console.log(`SpaceTwin listening on http://localhost:${port}`);
});
