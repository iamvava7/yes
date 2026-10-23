// Runs server/pro_stitch.py (OpenCV: exposure compensation, graph-cut seams,
// multi-band blending) when Python with OpenCV is installed, and reports
// whether it is, so the API can fall back to the JavaScript stitcher.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finishPanorama } from './stitch.js';

const SCRIPT = fileURLToPath(new URL('./pro_stitch.py', import.meta.url));
const TIMEOUT_MS = 5 * 60 * 1000;

// Windows installs Python as `py` (launcher) or `python`; elsewhere `python3`.
const CANDIDATES = process.env.SPACETWIN_PYTHON
  ? [[process.env.SPACETWIN_PYTHON]]
  : [['python3'], ['python'], ['py', '-3']];

let detected;

/** The Python command that has OpenCV, or null. Checked once per process. */
export function detectProStitch() {
  detected ??= (async () => {
    if (process.env.SPACETWIN_PRO_STITCH === '0') return null;
    for (const cmd of CANDIDATES) {
      const res = await run(cmd, ['--check'], '', 20000).catch(() => null);
      if (res?.code === 0) {
        try {
          const info = JSON.parse(res.stdout.trim().split('\n').pop());
          if (info.ok) return { cmd, opencv: info.opencv };
        } catch { /* not our output */ }
      }
    }
    return null;
  })();
  return detected;
}

/**
 * Stitch posed photos into a JPEG panorama.
 * @param frames [{ path, pose: { transform, intrinsics } }]
 * @returns { jpeg, width, height, photos, coverage }
 */
export async function proStitch(frames, { width = 4096 } = {}) {
  const py = await detectProStitch();
  if (!py) throw new Error('OpenCV stitcher is not installed');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'spacetwin-pro-'));
  try {
    const out = path.join(dir, 'pano.rgba');
    const spec = {
      width, out,
      frames: frames.map((f) => ({ path: f.path, transform: f.pose.transform.flat?.() ?? f.pose.transform, intrinsics: f.pose.intrinsics.flat?.() ?? f.pose.intrinsics })),
    };
    const res = await run(py.cmd, [], JSON.stringify(spec), TIMEOUT_MS);
    let info;
    try {
      info = JSON.parse(res.stdout.trim().split('\n').pop());
    } catch {
      throw new Error(`OpenCV stitcher failed: ${res.stderr.trim().split('\n').pop() || `exit ${res.code}`}`);
    }
    if (!info.ok) throw new Error(info.error);
    const rgba = await fs.readFile(out);
    if (rgba.length !== info.width * info.height * 4) throw new Error('OpenCV stitcher wrote a truncated panorama');
    const jpeg = finishPanorama(rgba, info.width, info.height);
    return { jpeg, width: info.width, height: info.height, photos: info.photos, coverage: info.coverage };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function run([bin, ...pre], args, input, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [...pre, SCRIPT, ...args], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.stdin.on('error', () => {}); // the child may exit before reading (e.g. --check)
    child.stdin.end(input);
  });
}
