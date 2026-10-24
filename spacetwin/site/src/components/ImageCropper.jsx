import React, { useState, useRef, useEffect } from "react";

// Reusable image cropper: zoom slider + drag to reposition.
// Crops via canvas and returns a JPEG blob to onSave.
export default function ImageCropper({ file, aspectRatio = 1, onSave, onCancel, title = "Ajustează poza" }) {
  const [imgSrc, setImgSrc] = useState("");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result);
    reader.readAsDataURL(file);
  }, [file]);

  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      const r = containerRef.current.getBoundingClientRect();
      setContainerSize({ w: r.width, h: r.height });
    };
    // Defer to next frame so the aspect-ratio sizing has settled
    requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [imgSrc]);

  const onImgLoad = () => {
    if (imgRef.current) {
      setImgSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  };

  const baseScale = imgSize.w > 0 ? Math.max(containerSize.w / imgSize.w, containerSize.h / imgSize.h) : 1;
  const dispW = imgSize.w * baseScale * zoom;
  const dispH = imgSize.h * baseScale * zoom;
  const maxOffsetX = Math.max(0, (dispW - containerSize.w) / 2);
  const maxOffsetY = Math.max(0, (dispH - containerSize.h) / 2);
  const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, position.x));
  const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, position.y));

  const handleStart = (clientX, clientY) => {
    setDragging(true);
    setDragStart({ x: clientX - clampedX, y: clientY - clampedY });
  };
  const handleMove = (clientX, clientY) => {
    if (!dragging) return;
    const nx = clientX - dragStart.x;
    const ny = clientY - dragStart.y;
    setPosition({
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, nx)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, ny)),
    });
  };
  const handleEnd = () => setDragging(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const img = imgRef.current;
      if (!img || imgSize.w === 0) { setSaving(false); return; }
      const canvas = document.createElement("canvas");
      const outW = 600;
      const outH = Math.round(600 / aspectRatio);
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      const left = (containerSize.w - dispW) / 2 + clampedX;
      const top = (containerSize.h - dispH) / 2 + clampedY;
      const totalScale = baseScale * zoom;
      const sx = -left / totalScale;
      const sy = -top / totalScale;
      const sw = containerSize.w / totalScale;
      const sh = containerSize.h / totalScale;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      canvas.toBlob((blob) => {
        if (blob) onSave(blob);
        setSaving(false);
      }, "image/jpeg", 0.92);
    } catch (e) {
      setSaving(false);
      onCancel?.();
    }
  };

  if (!imgSrc) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-navy-deep/80 p-4">
      <div className="w-full max-w-md rounded border border-border bg-white p-4 shadow-soft dark:bg-card">
        <h3 className="mb-3 font-heading text-lg font-bold text-navy dark:text-foreground">{title}</h3>
        <div
          ref={containerRef}
          className="relative mx-auto overflow-hidden rounded bg-black"
          style={{ width: "100%", aspectRatio: String(aspectRatio), touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={(e) => { e.preventDefault(); handleStart(e.touches[0].clientX, e.touches[0].clientY); }}
          onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); }}
          onTouchEnd={handleEnd}
        >
          <img
            ref={imgRef}
            src={imgSrc}
            alt=""
            draggable={false}
            onLoad={onImgLoad}
            className="absolute select-none"
            style={{
              left: `${(containerSize.w - dispW) / 2 + clampedX}px`,
              top: `${(containerSize.h - dispH) / 2 + clampedY}px`,
              width: `${dispW}px`,
              height: `${dispH}px`,
              maxWidth: "none",
            }}
          />
        </div>
        <div className="mt-4">
          <label className="text-sm font-semibold text-muted-foreground">Zoom</label>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="mt-1 w-full accent-emerald"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Trage pentru a repoziționa imaginea.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">
            Anulează
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded bg-emerald py-2.5 text-sm font-semibold text-white hover:bg-emerald/90 disabled:opacity-50">
            {saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}