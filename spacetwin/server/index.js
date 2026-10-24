import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createPlatform } from './platform/index.js';
import { detectProStitch } from './proStitch.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDist = path.join(root, 'web', 'dist');
const siteDir = path.join(root, 'site');
const siteDist = path.join(siteDir, 'dist');
const dataDir = process.env.DATA_DIR ?? path.join(root, 'data');
const port = Number(process.env.PORT ?? 3000);

// The VerifiCasa website (accounts, listings, payments, admin) runs in this
// same server. WEBSITE=off starts only the tour app.
const platform = process.env.WEBSITE === 'off' ? null : createPlatform({
  dataDir, siteDir, cacheDir: path.join(root, 'node_modules', '.cache', 'verificasa-functions'),
});

const app = await createApp({
  dataDir,
  sampleDir: path.join(root, 'assets', 'sample'),
  webDist: existsSync(webDist) ? webDist : undefined,
  siteDist: platform && existsSync(siteDist) ? siteDist : undefined,
  platform,
});

app.listen(port, async () => {
  console.log(`VerifiCasa listening on http://localhost:${port}`);
  if (platform) {
    console.log(`Website: ${existsSync(siteDist) ? 'http://localhost:' + port + '/' : 'not built yet (npm run build)'} · tours: /tours · data: ${path.join(dataDir, 'verificasa.db')}`);
    if (!process.env.ADMIN_EMAILS) console.log('Tip: set ADMIN_EMAILS=you@example.com so your account becomes SUPER_ADMIN.');
    if (!platform.mailer.configured) console.log('Email: not configured (RESEND_API_KEY); sign-up codes are printed here instead.');
  }
  const pro = await detectProStitch();
  console.log(pro
    ? `Pro stitcher ready (OpenCV ${pro.opencv}): seams routed around objects, multi-band blending.`
    : 'Pro stitcher off: install Python 3 and run "pip install opencv-python-headless numpy" for the best panoramas (phones still get the built-in stitcher).');
});
