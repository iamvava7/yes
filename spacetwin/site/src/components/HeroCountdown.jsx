import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCountry } from "@/components/CountryContext";

const TARGET = new Date("2026-08-28T10:00:00");

function diff() {
  const now = new Date();
  let d = TARGET - now;
  if (d < 0) d = 0;
  return {
    over: TARGET - now <= 0,
    days: Math.floor(d / 86400000),
    hours: Math.floor((d % 86400000) / 3600000),
    mins: Math.floor((d % 3600000) / 60000),
    secs: Math.floor((d % 60000) / 1000),
  };
}

// Odometer digit — the old digit slides up and out, the new one in from below.
function RollingDigit({ char, reduceMotion }) {
  if (reduceMotion) return <span className="tabular-nums">{char}</span>;
  return (
    <span className="relative inline-grid w-[0.62em] overflow-hidden text-center align-top">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={char}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="tabular-nums"
          style={{ gridArea: "1 / 1" }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function RollingDigits({ value, reduceMotion }) {
  return (
    <span className="inline-flex">
      {String(value).split("").map((char, i) => (
        <RollingDigit key={i} char={char} reduceMotion={reduceMotion} />
      ))}
    </span>
  );
}

// Launch counter: one solid rounded card, four soft digit tiles, one line of
// copy and one button. The digits keep their odometer roll.
export default function HeroCountdown({ className = "" }) {
  const { t, lang } = useCountry();
  const en = lang === "en";
  const [time, setTime] = useState(diff());
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const id = setInterval(() => setTime(diff()), 1000);
    return () => clearInterval(id);
  }, []);

  if (time.over) return null;

  const unit = (v, label) => (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-secondary px-1 py-2.5">
      <span className="font-heading text-2xl font-semibold leading-none text-foreground tnum sm:text-3xl">
        <RollingDigits value={String(v).padStart(2, "0")} reduceMotion={reduceMotion} />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
        {label}
      </span>
    </div>
  );

  return (
    <div className={className}>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-emerald px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
              {t("countdown_badge")}
            </span>
            <p className="mt-2 text-sm font-semibold text-foreground">{t("countdown_h")}</p>
          </div>

          <div className="flex shrink-0 items-stretch gap-2 sm:w-auto">
            {unit(time.days, t("countdown_days"))}
            {unit(time.hours, t("countdown_hours"))}
            {unit(time.mins, t("countdown_mins"))}
            {unit(time.secs, en ? "Seconds" : "Secunde")}
          </div>

          <Link
            to="/about"
            className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-emerald px-5 sm:h-11 text-sm font-semibold text-primary-foreground transition-colors hover:bg-emerald/90 sm:h-11"
          >
            {t("countdown_btn")}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
