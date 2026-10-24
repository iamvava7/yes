import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Instagram, X } from "lucide-react";

// Instagram pop-up: PRIMA PAGINĂ ȘI ATÂT.
//
// E montat în Layout, care înfășoară fiecare rută, iar temporizatorul nu știa
// nimic despre unde se află omul — așa că sărea peste orice pagină, la fiecare
// cinci minute. Inclusiv peste pachetele de boost, cu un strat negru și un
// buton „Dă Follow" fix peste butonul de cumpărare. Ca reclamă e enervant; în
// mijlocul unei plăți e o pierdere de bani.
//
// Deci: se programează doar pe „/", se închide singur dacă omul pleacă de pe
// prima pagină cât e deschis, și nu se reprogramează decât tot pe „/".
//
// Apare la 5 minute de navigare, stă 5 secunde, apoi se închide singur. Orice
// închidere (X, click pe fundal, automat) repornește numărătoarea.
const SHOW_INTERVAL = 5 * 60 * 1000; // 5 minutes between appearances
const HOLD_MS = 5000; // 5 seconds on screen
const HANDLE = "verificasaro";
const URL = "https://www.instagram.com/verificasaro";

export default function InstagramPopup() {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(100);
  const showTimer = useRef(null);
  const holdTimer = useRef(null);
  const progressRaf = useRef(null);

  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (progressRaf.current) cancelAnimationFrame(progressRaf.current);
    progressRaf.current = null;
  };

  const scheduleNext = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => setOpen(true), SHOW_INTERVAL);
  };

  // Run countdown progress bar while open and auto-close after HOLD_MS.
  useEffect(() => {
    if (!open) return;
    const start = performance.now();
    setProgress(100);

    const tick = (now) => {
      const pct = Math.max(0, 100 - ((now - start) / HOLD_MS) * 100);
      setProgress(pct);
      if (pct > 0) {
        progressRaf.current = requestAnimationFrame(tick);
      }
    };
    progressRaf.current = requestAnimationFrame(tick);

    holdTimer.current = setTimeout(() => close(), HOLD_MS);
    return () => clearHold();
     
  }, [open]);

  // Ceasul pornește doar pe prima pagină. Dacă omul pleacă de acolo, se oprește
  // numărătoarea ȘI se închide ce e pe ecran — altfel pop-up-ul programat pe „/"
  // ar apărea peste orice pagină pe care s-a dus între timp.
  useEffect(() => {
    if (!onHome) {
      if (showTimer.current) clearTimeout(showTimer.current);
      showTimer.current = null;
      clearHold();
      setOpen(false);
      return undefined;
    }
    scheduleNext();
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      clearHold();
    };

  }, [onHome]);

  const close = () => {
    clearHold();
    setOpen(false);
    if (onHome) scheduleNext(); // revine peste încă cinci minute, tot pe „/"
  };

  if (!open || !onHome) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4"
      onClick={close}
    >
      <div
        className="relative w-full max-w-xs overflow-hidden rounded bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={close}
          className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-foreground/70 shadow-soft transition hover:bg-white hover:text-foreground"
          aria-label="Închide"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-gradient-to-br from-[#feda75] via-[#fa7e1e] to-[#962fbf] px-5 pb-4 pt-5">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-white shadow-soft">
            <Instagram className="h-6 w-6 text-foreground" />
          </div>
        </div>

        <div className="px-5 py-4">
          <h3 className="font-heading text-lg font-bold text-navy">Urmărește-ne pe Instagram!</h3>
          <p className="mt-0.5 text-sm font-semibold text-emerald">@{HANDLE}</p>
          <p className="mt-1 text-xs text-muted-foreground">Noutăți imobiliare din toată România</p>

          <a
            href={URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-emerald px-4 py-2.5 text-sm font-bold text-white shadow-soft transition hover:opacity-90"
          >
            <Instagram className="h-4 w-4" /> Dă Follow
          </a>
        </div>

        {/* Countdown progress bar */}
        <div className="h-1 w-full bg-secondary">
          <div
            className="h-full bg-emerald transition-[width] duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}