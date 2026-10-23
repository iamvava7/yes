// Fill the parts of an equirectangular panorama no photo covered (usually
// the very top of the ceiling and the floor under the photographer) so they
// read as a soft continuation of the room instead of a grey hole. Each column
// fades from its last photographed colour toward the average colour around
// that pole; colours are smoothed across columns first so the fill doesn't
// streak. Used by the browser and server stitchers.

/**
 * @param rgba   Uint8ClampedArray/Buffer, top-down rows, alpha 0 marks a hole (set to 255 when filled)
 * @returns number of pixels filled
 */
export function fillHoles(rgba, width, height) {
  let filled = 0;
  for (const dir of [-1, 1]) { // -1: walk from the equator up to the top row; +1: down to the bottom
    const start = dir < 0 ? Math.floor(height / 2) - 1 : Math.floor(height / 2);
    const end = dir < 0 ? -1 : height;
    // colour and row where each column's photographed part ends
    const edge = new Float32Array(width * 3);
    const edgeRow = new Int32Array(width).fill(-1);
    for (let x = 0; x < width; x++) {
      for (let y = start; y !== end; y += dir) {
        const i = (y * width + x) * 4;
        if (rgba[i + 3] === 0) break;
        edge[x * 3] = rgba[i]; edge[x * 3 + 1] = rgba[i + 1]; edge[x * 3 + 2] = rgba[i + 2];
        edgeRow[x] = y;
      }
    }
    const pole = [0, 0, 0];
    let n = 0;
    for (let x = 0; x < width; x++) {
      if (edgeRow[x] < 0) continue;
      for (let c = 0; c < 3; c++) pole[c] += edge[x * 3 + c];
      n++;
    }
    if (!n) continue; // nothing photographed on this side at all
    for (let c = 0; c < 3; c++) pole[c] /= n;
    // smooth edge colours around the panorama (it wraps) so the fill has no streaks
    const radius = Math.max(2, Math.round(width / 96));
    const smooth = new Float32Array(width * 3);
    for (let x = 0; x < width; x++) {
      let k = 0;
      for (let d = -radius; d <= radius; d++) {
        const xx = (x + d + width) % width;
        if (edgeRow[xx] < 0) continue;
        for (let c = 0; c < 3; c++) smooth[x * 3 + c] += edge[xx * 3 + c];
        k++;
      }
      for (let c = 0; c < 3; c++) smooth[x * 3 + c] = k ? smooth[x * 3 + c] / k : pole[c];
    }
    for (let x = 0; x < width; x++) {
      const from = edgeRow[x] < 0 ? start : edgeRow[x];
      const span = Math.max(1, Math.abs(end - dir - from));
      for (let y = from; y !== end; y += dir) {
        const i = (y * width + x) * 4;
        if (rgba[i + 3] !== 0) continue;
        const t = Math.min(1, Math.abs(y - from) / span);
        const k = t * t * (3 - 2 * t); // smoothstep toward the pole colour
        for (let c = 0; c < 3; c++) rgba[i + c] = smooth[x * 3 + c] * (1 - k) + pole[c] * k;
        rgba[i + 3] = 255;
        filled++;
      }
    }
  }
  return filled;
}
