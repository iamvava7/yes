// Writes the small (2048 px) copy of a panorama that tours show first.
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { parentPort, workerData } from 'node:worker_threads';

try {
  const img = jpeg.decode(fs.readFileSync(workerData.file), { useTArray: true, maxMemoryUsageInMB: 2048, formatAsRGBA: true });
  const W = workerData.width, H = W / 2;
  const out = Buffer.alloc(W * H * 4);
  const sx = img.width / W, sy = img.height / H;
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 4;
          r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
        }
      }
      const o = (y * W + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  fs.writeFileSync(workerData.out, jpeg.encode({ data: out, width: W, height: H }, 85).data);
  parentPort.postMessage({ ok: true });
} catch (err) {
  parentPort.postMessage({ ok: false, error: err.message });
}
