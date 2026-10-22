import express from 'express';
import { imageSize } from 'image-size';
import multer from 'multer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isSimplePolygon, normalizePolygon, spaceStats } from '../shared/geometry.js';
import { Worker } from 'node:worker_threads';
import { toFloorPlanSvg, toObj } from './exporters.js';
import { capturedRoomToRooms } from './roomplan.js';
import { newId, NotFoundError, Store } from './store.js';

const PANO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (msg) => new HttpError(400, msg);

function num(value, name, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`${name} must be a number between ${min} and ${max}`);
  return n;
}

function str(value, name, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw bad(`${name} must be a non-empty string of at most ${max} characters`);
  return value.trim();
}

function validateRoom(input, i) {
  if (!input || !Array.isArray(input.points)) throw bad(`rooms[${i}].points must be an array`);
  const raw = input.points.map((p, j) => {
    if (!Array.isArray(p) || p.length !== 2) throw bad(`rooms[${i}].points[${j}] must be [x, z]`);
    return [num(p[0], 'x', { min: -1000, max: 1000 }), num(p[1], 'z', { min: -1000, max: 1000 })];
  });
  const points = normalizePolygon(raw);
  if (points.length < 3) throw bad(`rooms[${i}] needs at least 3 distinct corners`);
  if (!isSimplePolygon(points)) throw bad(`rooms[${i}] walls cross each other`);
  return {
    id: typeof input.id === 'string' && /^[a-z0-9]{12}$/.test(input.id) ? input.id : newId(),
    name: input.name === undefined ? `Room ${i + 1}` : str(input.name, 'name'),
    height: input.height === undefined ? 2.6 : num(input.height, 'height', { min: 1.5, max: 10 }),
    points,
  };
}

const LISTING_STATUS = ['For sale', 'For rent', 'Under offer', 'Sold', 'Off market'];

/** Property details shown beside the tour. Every field is optional; null clears one. */
function parseListing(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('listing must be an object');
  const out = {};
  const text = (key, max) => {
    if (input[key] === undefined) return;
    if (input[key] === null || input[key] === '') { out[key] = null; return; }
    if (typeof input[key] !== 'string' || input[key].length > max) throw bad(`listing.${key} must be text of at most ${max} characters`);
    out[key] = input[key].trim();
  };
  const count = (key, max) => {
    if (input[key] === undefined) return;
    if (input[key] === null || input[key] === '') { out[key] = null; return; }
    out[key] = num(input[key], `listing.${key}`, { min: 0, max });
  };
  text('address', 200);
  text('description', 4000);
  text('contactName', 120);
  text('contactPhone', 40);
  text('contactEmail', 200);
  text('currency', 3);
  count('price', 1e12);
  count('beds', 100);
  count('baths', 100);
  count('yearBuilt', 3000);
  if (input.status !== undefined) {
    if (input.status !== null && !LISTING_STATUS.includes(input.status)) throw bad(`listing.status must be one of ${LISTING_STATUS.join(', ')}`);
    out.status = input.status;
  }
  if (out.currency && !/^[A-Z]{3}$/.test(out.currency)) throw bad('listing.currency must be a 3-letter code like EUR');
  if (out.contactEmail && !/^[^@\s]+@[^@\s]+$/.test(out.contactEmail)) throw bad('listing.contactEmail is not an email address');
  return out;
}

function withStats(space) {
  return { ...space, stats: spaceStats(space) };
}

export async function createApp({ dataDir, sampleDir, webDist } = {}) {
  const store = new Store(dataDir);
  await store.init();
  const upload = multer({
    dest: path.join(os.tmpdir(), 'spacetwin-uploads'),
    limits: { fileSize: 60 * 1024 * 1024, files: 50 },
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' })); // RoomPlan scans with many objects can be large

  const captureUpload = multer({
    dest: path.join(os.tmpdir(), 'spacetwin-uploads'),
    limits: { fileSize: 15 * 1024 * 1024, files: 80, fieldSize: 2 * 1024 * 1024 },
  });

  const api = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  api.get('/spaces', wrap(async (_req, res) => {
    const spaces = await store.list();
    res.json(spaces.map((s) => ({
      id: s.id, name: s.name, updatedAt: s.updatedAt,
      coverScanId: s.scans[0]?.id ?? null, stats: spaceStats(s), listing: s.listing ?? null,
    })));
  }));

  api.post('/spaces', wrap(async (req, res) => {
    const space = await store.create(str(req.body?.name ?? 'Untitled space', 'name'));
    res.status(201).json(withStats(space));
  }));

  api.get('/spaces/:id', wrap(async (req, res) => {
    res.json(withStats(await store.get(req.params.id)));
  }));

  api.patch('/spaces/:id', wrap(async (req, res) => {
    const listing = req.body?.listing === undefined ? undefined : parseListing(req.body.listing);
    const space = await store.update(req.params.id, (s) => {
      if (req.body?.name !== undefined) s.name = str(req.body.name, 'name');
      if (listing) s.listing = { ...(s.listing ?? {}), ...listing };
    });
    res.json(withStats(space));
  }));

  api.delete('/spaces/:id', wrap(async (req, res) => {
    await store.remove(req.params.id);
    res.status(204).end();
  }));

  // Scans: one equirectangular panorama per capture point.
  api.post('/spaces/:id/scans', upload.array('panorama'), wrap(async (req, res) => {
    const files = req.files ?? [];
    try {
      if (!files.length) throw bad('attach one or more panoramas in the "panorama" field');
      await store.get(req.params.id);
      const accepted = [];
      for (const f of files) {
        const ext = PANO_TYPES[f.mimetype];
        if (!ext) throw bad(`${f.originalname}: use JPEG, PNG or WebP`);
        let dims;
        try {
          dims = imageSize(await fs.readFile(f.path));
        } catch {
          throw bad(`${f.originalname}: not a readable image`);
        }
        const ratio = dims.width / dims.height;
        if (Math.abs(ratio - 2) > 0.05) {
          throw bad(`${f.originalname} is ${dims.width}×${dims.height}; a 360° panorama must be 2:1 (equirectangular)`);
        }
        accepted.push({ f, ext, dims });
      }
      const space = await store.update(req.params.id, async (s) => {
        for (const { f, ext, dims } of accepted) {
          const id = newId();
          const file = `${id}${ext}`;
          await fs.copyFile(f.path, store.panoPath(s.id, file));
          const last = s.scans.at(-1);
          s.scans.push({
            id,
            name: path.parse(f.originalname).name.slice(0, 120) || `Scan ${s.scans.length + 1}`,
            file,
            width: dims.width,
            height: dims.height,
            position: last ? { x: last.position.x + 2, z: last.position.z } : { x: 0, z: 0 },
            cameraHeight: 1.5,
            heading: 0,
          });
        }
      });
      res.status(201).json(withStats(space));
    } finally {
      await Promise.all(files.map((f) => fs.rm(f.path, { force: true })));
    }
  }));

  api.get('/spaces/:id/scans/:scanId/pano', wrap(async (req, res) => {
    const space = await store.get(req.params.id);
    const scan = space.scans.find((s) => s.id === req.params.scanId);
    if (!scan) throw new NotFoundError('scan not found');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(store.panoPath(space.id, scan.file));
  }));

  api.patch('/spaces/:id/scans/:scanId', wrap(async (req, res) => {
    const b = req.body ?? {};
    const space = await store.update(req.params.id, (s) => {
      const scan = s.scans.find((x) => x.id === req.params.scanId);
      if (!scan) throw new NotFoundError('scan not found');
      if (b.name !== undefined) scan.name = str(b.name, 'name');
      if (b.position !== undefined) {
        scan.position = { x: num(b.position?.x, 'position.x', { min: -1000, max: 1000 }), z: num(b.position?.z, 'position.z', { min: -1000, max: 1000 }) };
      }
      if (b.cameraHeight !== undefined) scan.cameraHeight = num(b.cameraHeight, 'cameraHeight', { min: 0.2, max: 5 });
      if (b.heading !== undefined) scan.heading = ((num(b.heading, 'heading') % 360) + 360) % 360;
    });
    res.json(withStats(space));
  }));

  api.delete('/spaces/:id/scans/:scanId', wrap(async (req, res) => {
    let file;
    const space = await store.update(req.params.id, (s) => {
      const i = s.scans.findIndex((x) => x.id === req.params.scanId);
      if (i < 0) throw new NotFoundError('scan not found');
      file = s.scans[i].file;
      s.scans.splice(i, 1);
      s.tags = s.tags.filter((t) => t.scanId !== req.params.scanId);
    });
    await fs.rm(store.panoPath(space.id, file), { force: true });
    res.json(withStats(space));
  }));

  // Rooms: the whole floor plan is replaced at once by the editor.
  api.put('/spaces/:id/rooms', wrap(async (req, res) => {
    if (!Array.isArray(req.body?.rooms)) throw bad('body must be { rooms: [...] }');
    if (req.body.rooms.length > 500) throw bad('too many rooms');
    const rooms = req.body.rooms.map(validateRoom);
    const space = await store.update(req.params.id, (s) => {
      s.rooms = rooms;
    });
    res.json(withStats(space));
  }));

  // Tags: annotations pinned to a 3D point.
  const parseTag = (b, partial) => {
    const t = {};
    if (!partial || b.label !== undefined) t.label = str(b.label, 'label', 80);
    if (!partial || b.description !== undefined) {
      t.description = b.description == null ? '' : String(b.description).slice(0, 2000);
    }
    if (!partial || b.position !== undefined) {
      if (!Array.isArray(b.position) || b.position.length !== 3) throw bad('position must be [x, y, z]');
      t.position = b.position.map((v, i) => num(v, `position[${i}]`, { min: -1000, max: 1000 }));
    }
    return t;
  };

  api.post('/spaces/:id/tags', wrap(async (req, res) => {
    const tag = { id: newId(), ...parseTag(req.body ?? {}, false) };
    await store.update(req.params.id, (s) => {
      if (s.tags.length >= 1000) throw bad('too many tags');
      s.tags.push(tag);
    });
    res.status(201).json(tag);
  }));

  api.patch('/spaces/:id/tags/:tagId', wrap(async (req, res) => {
    const patch = parseTag(req.body ?? {}, true);
    const tag = await store.update(req.params.id, (s) => {
      const t = s.tags.find((x) => x.id === req.params.tagId);
      if (!t) throw new NotFoundError('tag not found');
      Object.assign(t, patch);
      return t;
    });
    res.json(tag);
  }));

  api.delete('/spaces/:id/tags/:tagId', wrap(async (req, res) => {
    await store.update(req.params.id, (s) => {
      const n = s.tags.length;
      s.tags = s.tags.filter((t) => t.id !== req.params.tagId);
      if (s.tags.length === n) throw new NotFoundError('tag not found');
    });
    res.status(204).end();
  }));

  // Native app: rooms measured by Apple RoomPlan (LiDAR), in ARKit world space.
  api.post('/spaces/:id/roomplan', wrap(async (req, res) => {
    const b = req.body ?? {};
    let converted;
    try {
      converted = capturedRoomToRooms(b.capturedRoom, { name: typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 100) : 'Scanned room' });
    } catch (err) {
      throw bad(`capturedRoom: ${err.message}`);
    }
    const space = await store.update(req.params.id, (s) => {
      const base = b.replace ? [] : s.rooms;
      s.rooms = [...base, ...converted].map(validateRoom);
    });
    res.status(201).json(withStats(space));
  }));

  // Native app: posed photos (ARKit camera transform + intrinsics) stitched here into a scan.
  api.post('/spaces/:id/captures', captureUpload.array('frames'), wrap(async (req, res) => {
    const files = req.files ?? [];
    try {
      await store.get(req.params.id);
      let meta;
      try {
        meta = JSON.parse(req.body?.meta ?? '');
      } catch {
        throw bad('meta must be a JSON string field');
      }
      if (!Array.isArray(meta.frames) || meta.frames.length !== files.length || files.length < 2) {
        throw bad('send at least two "frames" files and one meta.frames entry (transform, intrinsics) per file, in the same order');
      }
      const width = meta.width === undefined ? 4096 : num(meta.width, 'width', { min: 512, max: 8192 });
      if (width % 2) throw bad('width must be even');
      const frames = await Promise.all(files.map(async (f, i) => ({ buffer: await fs.readFile(f.path), pose: meta.frames[i] })));
      const result = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./stitch-worker.js', import.meta.url), { workerData: { frames, width } });
        worker.once('message', resolve);
        worker.once('error', reject);
      });
      if (!result.ok) throw bad(`could not stitch: ${result.error}`);
      const [x, y, z] = result.position;
      const cameraHeight = meta.cameraHeight !== undefined
        ? num(meta.cameraHeight, 'cameraHeight', { min: 0.2, max: 5 })
        : meta.floorY !== undefined ? Math.min(5, Math.max(0.2, y - num(meta.floorY, 'floorY'))) : 1.5;
      const space = await store.update(req.params.id, async (s) => {
        const id = newId();
        const file = `${id}.jpg`;
        await fs.writeFile(store.panoPath(s.id, file), Buffer.from(result.jpeg));
        s.scans.push({
          id,
          name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim().slice(0, 120) : `Spot ${s.scans.length + 1}`,
          file, width: result.width, height: result.height,
          position: { x: round3(x), z: round3(z) },
          cameraHeight: round3(cameraHeight),
          heading: 0, // posed photos are stitched directly in world orientation
        });
      });
      res.status(201).json(withStats(space));
    } finally {
      await Promise.all(files.map((f) => fs.rm(f.path, { force: true })));
    }
  }));

  // Exports.
  api.get('/spaces/:id/export/model.obj', wrap(async (req, res) => {
    const space = await store.get(req.params.id);
    res.type('text/plain').attachment(`${slug(space.name)}.obj`).send(toObj(space));
  }));

  api.get('/spaces/:id/export/floorplan.svg', wrap(async (req, res) => {
    const space = await store.get(req.params.id);
    res.type('image/svg+xml');
    if (req.query.download !== undefined) res.attachment(`${slug(space.name)}-floorplan.svg`);
    res.send(toFloorPlanSvg(space));
  }));

  api.get('/spaces/:id/export/space.json', wrap(async (req, res) => {
    const space = await store.get(req.params.id);
    res.attachment(`${slug(space.name)}.json`).json(withStats(space));
  }));

  // Demo content: a two-room apartment rendered by scripts/make_sample.py.
  api.post('/sample', wrap(async (_req, res) => {
    if (!sampleDir) throw new HttpError(404, 'no sample data configured');
    const manifest = JSON.parse(await fs.readFile(path.join(sampleDir, 'manifest.json'), 'utf8'));
    const created = await store.create(manifest.name);
    const space = await store.update(created.id, async (s) => {
      for (const sc of manifest.scans) {
        const id = newId();
        const file = `${id}${path.extname(sc.file)}`;
        await fs.copyFile(path.join(sampleDir, path.basename(sc.file)), store.panoPath(s.id, file));
        const dims = imageSize(await fs.readFile(store.panoPath(s.id, file)));
        s.scans.push({ id, name: sc.name, file, width: dims.width, height: dims.height, position: sc.position, cameraHeight: sc.cameraHeight, heading: sc.heading });
      }
      s.rooms = manifest.rooms.map(validateRoom);
      s.tags.push({ id: newId(), label: 'Window', description: 'South-facing, double glazed.', position: [2.4, 1.6, 0.01] });
      s.listing = {
        address: 'Unit 4B, sample building', status: 'For sale', price: 285000, currency: 'EUR', beds: 1, baths: 1,
        description: 'A demonstration flat rendered by SpaceTwin: bright living room with a south-facing window, and a quiet bedroom with built-in wardrobe.',
        contactName: 'SpaceTwin demo',
      };
    });
    res.status(201).json(withStats(space));
  }));

  api.use((_req, _res, next) => next(new HttpError(404, 'not found')));

  app.use('/api', api);

  if (webDist) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use((err, _req, res, _next) => {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON body' });
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'space';
}
