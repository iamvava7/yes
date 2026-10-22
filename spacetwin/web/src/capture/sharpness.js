// Focus/motion-blur score: variance of the Laplacian, the classic OpenCV
// blur metric. Sharp images have strong second derivatives at edges, so the
// Laplacian varies a lot; blur flattens it. The score depends on the scene
// (a plain wall scores low even when sharp), so it is only meaningful when
// comparing shots of the same view, which is how the capture burst uses it.

/** Variance of the 4-neighbour Laplacian over a grayscale image. */
export function laplacianVariance(gray, w, h) {
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      sum += l;
      sumSq += l * l;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Grayscale from RGBA pixel data. */
export function toGray(rgba, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return g;
}

/** Score the centre of an image source (video, canvas, bitmap) at a small size. */
export function sharpnessOf(source, sw, sh, ctx) {
  const W = 256, H = Math.round((256 * sh) / sw);
  ctx.canvas.width = W;
  ctx.canvas.height = H;
  // centre 60%: edges are softest optically and least representative
  const cw = sw * 0.6, ch = sh * 0.6;
  ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  return laplacianVariance(toGray(data, W, H), W, H);
}
