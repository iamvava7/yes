import React, { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Share2, Heart, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useCountry } from "@/components/CountryContext";
import { Image } from "@/components/ui/image";

// Galerie fullscreen (lightbox) pentru imaginile unui anunț.
// Responsive PC + mobil: swipe stânga/dreapta, săgeți mari la margini,
// thumbnail-uri jos, controale sus (iesire, contor, distribuire, salvare).
function LightboxImage({ src, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <>
      {!loaded && !failed && (
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      )}
      {failed ? (
        <div className="flex flex-col items-center gap-2 text-white/60">
          <span className="text-sm">Imaginea nu a putut fi încărcată.</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`max-h-full max-w-full w-auto h-auto select-none object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
  );
}

export default function Lightbox({ images, index, onClose, onIndex, saved = false, onToggleSave, title }) {
  const { t } = useCountry();
  const { toast } = useToast();
  const touchX = useRef(null);
  const total = images.length;
  const current = Math.max(0, Math.min(index, total - 1));

  const go = useCallback(
    (dir) => {
      if (total <= 1) return;
      onIndex((current + dir + total) % total);
    },
    [current, total, onIndex]
  );

  // Navigare cu tastatura
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, onClose]);

  const handleShare = async () => {
    const url = window.location.href;
    const data = { title: title || "VerifiCasa", text: title || "VerifiCasa", url };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({ title: t("lb_link_copied") });
    } catch (e) {
      toast({ title: t("lb_link_copied") });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex flex-col bg-navy-deep/95"
    >
      {/* Header controls */}
      <div className="flex items-center justify-between px-4 py-4 text-white sm:px-6">
        <button onClick={onClose} aria-label={t("lb_close")} className="flex h-10 w-10 items-center justify-center rounded bg-white/10 transition hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold tracking-wide">
          {current + 1}/{total}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} aria-label={t("lb_share")} className="flex h-10 w-10 items-center justify-center rounded bg-white/10 transition hover:bg-white/20">
            <Share2 className="h-5 w-5" />
          </button>
          <button onClick={onToggleSave} aria-label={t("lb_save")} className="flex h-10 w-10 items-center justify-center rounded bg-white/10 transition hover:bg-white/20">
            <Heart className={`h-5 w-5 ${saved ? "fill-gold text-gold" : "text-white"}`} />
          </button>
        </div>
      </div>

      {/* Main viewport */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2 sm:px-16"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <AnimatePresence>
          {images[current] ? (
            <motion.div
              key={current}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center px-2 sm:px-16"
            >
              {/* Plain <img>, deliberat NU componenta Image/useSize: aici imaginea
                  stă imbricată în absolute + flex + flex (items-center), unde un
                  wrapper cu înaltime procentuală a picat să se măsoare corect
                  (ecran negru, "poza nu se încarcă"). Un <img> simplu cu
                  max-h-full/max-w-full nu depinde de nicio măsurătoare JS. */}
              <LightboxImage src={images[current]} alt={`${title || "VerifiCasa"} ${current + 1}`} />
            </motion.div>
          ) : (
            <div className="text-sm text-white/60">{t("info_missing")}</div>
          )}
        </AnimatePresence>

        {/* Side arrows — PC & mobil */}
        {total > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label={t("pc_prev")} className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded bg-white/15 text-white transition hover:bg-white/30 sm:h-14 sm:w-14">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button onClick={() => go(1)} aria-label={t("pc_next")} className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded bg-white/15 text-white transition hover:bg-white/30 sm:h-14 sm:w-14">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {total > 1 && (
        <div className="no-scrollbar flex justify-start gap-2 overflow-x-auto px-4 py-4 sm:justify-center sm:px-6">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => onIndex(i)}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-16 sm:w-24 ${i === current ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
            >
              <Image src={img} alt={`thumb ${i + 1}`} fittingType="fill" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}