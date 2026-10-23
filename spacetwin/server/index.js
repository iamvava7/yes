import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { detectProStitch } from './proStitch.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDist = path.join(root, 'web', 'dist');
const port = Number(process.env.PORT ?? 3000);

const app = await createApp({
  dataDir: process.env.DATA_DIR ?? path.join(root, 'data'),
  sampleDir: path.join(root, 'assets', 'sample'),
  webDist: existsSync(webDist) ? webDist : undefined,
});

app.listen(port, async () => {
  console.log(`SpaceTwin listening on http://localhost:${port}`);
  const pro = await detectProStitch();
  console.log(pro
    ? `Pro stitcher ready (OpenCV ${pro.opencv}): seams routed around objects, multi-band blending.`
    : 'Pro stitcher off: install Python 3 and run "pip install opencv-python-headless numpy" for the best panoramas (phones still get the built-in stitcher).');
});
