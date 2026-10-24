import { base44 } from "@/api/base44Client";

// Downscale + re-encode large phone/camera photos before upload so they upload
// fast and reliably. Returns the original file for non-images or tiny images.
export async function compressImage(file, maxDim = 1600, quality = 0.82) {
  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  // Skip already-small images (under ~1.2MB) and small dimensions.
  if (file.size && file.size < 1_200_000) {
    try {
      const img = await loadImage(file);
      if (img.width <= maxDim && img.height <= maxDim) return file;
    } catch {
      return file;
    }
  }
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale >= 1) return file;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    return blob || file;
  } catch {
    return file;
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// Compress + upload many files in parallel. Returns an array of file_url strings.
// `max` caps how many are uploaded; extras are dropped. Partial successes are
// kept — only a total failure throws.
export async function uploadPhotos(files, max) {
  const slice = Array.from(files || []).slice(0, max);
  if (!slice.length) return [];
  const results = await Promise.allSettled(
    slice.map(async (f) => {
      const blob = await compressImage(f);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
      return file_url;
    })
  );
  const ok = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .filter(Boolean);
  if (!ok.length && results.some((r) => r.status === "rejected")) {
    throw new Error("upload_failed");
  }
  return ok;
}