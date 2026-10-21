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
  deleteSpace: (id) => request('DELETE', `/spaces/${id}`),
  updateScan: (id, scanId, patch) => request('PATCH', `/spaces/${id}/scans/${scanId}`, patch),
  deleteScan: (id, scanId) => request('DELETE', `/spaces/${id}/scans/${scanId}`),
  putRooms: (id, rooms) => request('PUT', `/spaces/${id}/rooms`, { rooms }),
  createTag: (id, tag) => request('POST', `/spaces/${id}/tags`, tag),
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
