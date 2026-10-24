// Uploaded files (photos, avatars, videos, 3D models), stored under
// data/files and served from /files/<name>.

import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PlatformError } from './entities.js';

export const MAX_UPLOAD = 60 * 1024 * 1024;

const TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', pdf: 'application/pdf',
};
const BY_MIME = Object.fromEntries(Object.entries(TYPES).map(([ext, mime]) => [mime, ext]));
BY_MIME['image/jpg'] = 'jpg';

export function createFiles({ dataDir }) {
  const dir = path.join(dataDir, 'files');

  return {
    dir,
    types: TYPES,

    // `name` and `mime` come from the uploader; only known media types are kept.
    async save(buf, { name = '', mime = '' } = {}) {
      if (!buf?.length) throw new PlatformError(400, 'Empty file');
      if (buf.length > MAX_UPLOAD) throw new PlatformError(413, 'File too large');
      let ext = path.extname(String(name)).slice(1).toLowerCase();
      if (!TYPES[ext]) ext = BY_MIME[String(mime).toLowerCase()] ?? '';
      if (!TYPES[ext]) throw new PlatformError(415, 'Only photos, videos, PDFs and 3D models can be uploaded');
      await fs.mkdir(dir, { recursive: true });
      const file = `${randomBytes(12).toString('hex')}.${ext}`;
      await fs.writeFile(path.join(dir, file), buf);
      return { file_url: `/files/${file}` };
    },
  };
}
