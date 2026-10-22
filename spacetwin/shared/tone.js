// Final colour finish shared by the browser and server stitchers.

/**
 * Gentle automatic white balance and levels, like a camera's "auto" finish.
 * White balance looks only at the brightest unclipped areas (usually white
 * ceilings and walls) and neutralises half of their tint, within ±8%, so a
 * warmly lit room stays warm instead of turning blue. Levels stretch the
 * 0.3–99.7th percentiles, also bounded. Returns one 256-entry lookup table
 * per channel.
 */
export function toneCurve(pixels) {
  const hist = new Uint32Array(256);
  const step = 4 * 7; // sample every 7th pixel
  for (let i = 0; i < pixels.length; i += step) {
    hist[Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2])]++;
  }
  const total = hist.reduce((a, b) => a + b, 0);
  const percentile = (p) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * p) return v; }
    return 255;
  };
  const black = Math.min(percentile(0.003), 16), white = Math.max(percentile(0.997), 220);
  const brightFrom = percentile(0.9);
  const sum = [0, 0, 0];
  let bright = 0;
  for (let i = 0; i < pixels.length; i += step) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (l >= brightFrom && Math.max(r, g, b) < 250) { sum[0] += r; sum[1] += g; sum[2] += b; bright++; }
  }
  const grey = bright ? (sum[0] + sum[1] + sum[2]) / 3 : 0;
  const wb = sum.map((c) => (bright && c ? Math.min(1.08, Math.max(0.92, 1 + 0.5 * (grey / c - 1))) : 1));
  return wb.map((gain) => {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = ((v * gain - black) / (white - black)) * 255;
    return lut;
  });
}
