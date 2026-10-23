async function request(method, url, body) {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${method} ${url} failed (${res.status})`);
  return data;
}

export const api = {
  listSpaces: () => request('GET', '/spaces'),
  createSpace: (name) => request('POST', '/spaces', { name }),
  createSample: () => request('POST', '/sample'),
  getSpace: (id) => request('GET', `/spaces/${id}`),
  renameSpace: (id, name) => request('PATCH', `/spaces/${id}`, { name }),
  updateListing: (id, listing) => request('PATCH', `/spaces/${id}`, { listing }),
  deleteSpace: (id) => request('DELETE', `/spaces/${id}`),
  updateScan: (id, scanId, patch) => request('PATCH', `/spaces/${id}/scans/${scanId}`, patch),
  deleteScan: (id, scanId) => request('DELETE', `/spaces/${id}/scans/${scanId}`),
  putRooms: (id, rooms) => request('PUT', `/spaces/${id}/rooms`, { rooms }),
  createTag: (id, tag) => request('POST', `/spaces/${id}/tags`, tag),
  capabilities: () => request('GET', '/capabilities'),

  /**
   * Re-stitch captured photos on the server with OpenCV, using the rotations
   * and lens the phone already solved. Resolves to the panorama JPEG blob.
   * Poses use the native-capture format: camera → world matrix and pinhole
   * intrinsics, both column-major.
   */
  async proStitch(frames, quaternions, vfov, width) {
    const form = new FormData();
    const poses = frames.map((f, i) => {
      const ty = Math.tan((vfov * Math.PI) / 360), tx = ty * (f.width / f.height);
      const fx = f.width / 2 / tx, fy = f.height / 2 / ty;
      form.append('frames', f.blob, `f${i}.jpg`);
      return { transform: rotationMatrix(quaternions[i]), intrinsics: [fx, 0, 0, 0, fy, 0, f.width / 2 - 0.5, f.height / 2 - 0.5, 1] };
    });
    form.append('meta', JSON.stringify({ width, frames: poses }));
    const res = await fetch('/api/stitch', { method: 'POST', body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `stitch failed (${res.status})`);
    }
    return res.blob();
  },
  deleteTag: (id, tagId) => request('DELETE', `/spaces/${id}/tags/${tagId}`),

  /** Upload panoramas with progress (fetch has no upload progress events). */
  uploadScans(id, files, onProgress) {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      for (const f of files) form.append('panorama', f, f.name);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/spaces/${id}/scans`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error ?? `upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('upload failed: network error'));
      xhr.send(form);
    });
  },
};

export const panoUrl = (spaceId) => (scan) => `/api/spaces/${spaceId}/scans/${scan.id}/pano?f=${scan.file}`;
export const exportUrl = (spaceId, file) => `/api/spaces/${spaceId}/export/${file}`;

/** Column-major 4×4 rotation matrix of a unit quaternion {x, y, z, w}. */
function rotationMatrix({ x, y, z, w }) {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ];
}
