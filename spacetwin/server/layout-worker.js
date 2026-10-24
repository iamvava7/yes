// Decodes a panorama and finds its room off the main thread (see layout.js).
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { parentPort, workerData } from 'node:worker_threads';
import { estimateLayout, toGrey } from './layout.js';

try {
  const img = jpeg.decode(fs.readFileSync(workerData.file), { useTArray: true, maxMemoryUsageInMB: 2048, formatAsRGBA: true });
  const { grey, W, H } = toGrey(img.data, img.width, img.height, 1024);
  parentPort.postMessage({ ok: true, layout: estimateLayout(grey, W, H, { cameraHeight: workerData.cameraHeight }) });
} catch (err) {
  parentPort.postMessage({ ok: false, error: err.message });
}
