// Runs stitchPosed off the main thread so the API stays responsive.
import { parentPort, workerData } from 'node:worker_threads';
import { prepareFrame, stitchPosed } from './stitch.js';

try {
  const frames = workerData.frames.map((f) => prepareFrame(Buffer.from(f.buffer), f.pose));
  const result = stitchPosed(frames, { width: workerData.width });
  const position = frames.map((f) => f.position).reduce((s, p) => s.map((v, i) => v + p[i] / frames.length), [0, 0, 0]);
  parentPort.postMessage({ ok: true, jpeg: result.jpeg, width: result.width, height: result.height, position });
} catch (err) {
  parentPort.postMessage({ ok: false, error: err.message });
}
