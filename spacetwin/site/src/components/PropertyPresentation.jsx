import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Image } from "@/components/ui/image";

const SLIDE_MS = 4200;
const RESUME_DELAY = 3200;
const DRAG_THRESHOLD = 60;

// Direcții de pan alternante — fiecare poză primește un zoom+pan ușor diferit,
// ca o prezentare montată, nu un simplu zoom static repetat identic.
const PANS = [
  { x: "-3%", y: "1.5%" },
  { x: "3%", y: "-1.5%" },
  { x: "-2.5%", y: "-2%" },
  { x: "2.5%", y: "2%" },
];

// Tab "Prezentare" — rulează automat prin pozele anunțului cu un efect de
// zoom + pan lent (stil cinematic), fără să fie nevoie de play. Navigație
// manuală posibilă oricând — trage/swipe stânga-dreapta sau săgețile de pe
// margini; playback-ul automat (și zoom-ul) se reia singur după o scurtă
// pauză de inactivitate. Apare doar dacă anunțul are poze.
export default function PropertyPresentation({ images, title }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const timerRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const total = images?.length || 0;

  const goTo = useCallback((next) => {
    if (total < 1) return;
    setIdx(((next % total) + total) % total);
  }, [total]);

  const scheduleResume = useCallback(() => {
    setPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setPaused(false), RESUME_DELAY);
  }, []);

  const holdPause = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    setPaused(true);
  }, []);

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!images?.length || images.length < 2 || reduceMotion || paused) return;
    timerRef.current = setInterval(() => setIdx((i) => (i + 1) % images.length), SLIDE_MS);
    return () => clearInterval(timerRef.current);
  }, [images?.length, reduceMotion, paused]);

  if (!images?.length) return null;

  const handleDragEnd = (e, info) => {
    const power = Math.abs(info.offset.x) + Math.abs(info.velocity.x) * 0.2;
    if (power > DRAG_THRESHOLD) goTo(idx + (info.offset.x < 0 ? 1 : -1));
    scheduleResume();
  };

  return (
    <div
      className="relative overflow-hidden rounded border border-border/60 bg-navy-deep shadow-[0_30px_80px_-30px_rgba(16,24,40,0.4)]"
      style={{ aspectRatio: "16 / 10" }}
      onMouseEnter={holdPause}
      onMouseLeave={scheduleResume}
    >
      <motion.div
        className={`absolute inset-0 ${total > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
        drag={total > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragStart={holdPause}
        onDragEnd={handleDragEnd}
      >
        <AnimatePresence>
          {images.map((img, i) => i === idx && (
            <motion.div
              key={i}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            >
              <motion.div
                className="h-full w-full"
                initial={{ scale: 1.02, x: "0%", y: "0%" }}
                animate={
                  reduceMotion
                    ? {}
                    : { scale: [1.02, 1.18, 1.02], x: ["0%", PANS[i % PANS.length].x, "0%"], y: ["0%", PANS[i % PANS.length].y, "0%"] }
                }
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              >
                <Image src={img} alt={`${title || ""} ${i + 1}`} fittingType="fill" className="h-full w-full pointer-events-none" />
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent sm:h-28" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent" />

      <span className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-white">
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald opacity-70 ${paused ? "" : "animate-ping"}`} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald" />
        </span>
        Prezentare live
      </span>

      {total > 1 && (
        <>
          <button
            onClick={() => { goTo(idx - 1); scheduleResume(); }}
            aria-label="Poza anterioară"
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30 sm:left-4 sm:h-12 sm:w-12"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button
            onClick={() => { goTo(idx + 1); scheduleResume(); }}
            aria-label="Poza următoare"
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30 sm:right-4 sm:h-12 sm:w-12"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); scheduleResume(); }}
              aria-label={`Poza ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === idx ? "w-7 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
