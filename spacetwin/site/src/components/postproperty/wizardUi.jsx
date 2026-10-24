import React from "react";
import { motion } from "framer-motion";

export const inputCls =
  "w-full rounded border border-border bg-background px-3.5 py-3 text-base text-foreground outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/15 dark:bg-card";

export function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}{required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}

export function Chip({ active, onClick, icon: Icon, label }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={
        "flex items-center gap-1.5 rounded border px-3.5 py-2 text-sm font-semibold transition-colors " +
        (active
          ? "border-emerald bg-emerald text-white shadow-soft"
          : "border-border bg-white text-foreground/70 hover:border-emerald/50 hover:bg-emerald-soft/30 dark:bg-card")
      }
    >
      {Icon && <Icon className={"h-4 w-4 shrink-0 " + (active ? "text-white" : "text-emerald")} strokeWidth={2} />}
      {label}
    </motion.button>
  );
}

export function ChoiceCard({ active, onClick, icon: Icon, iconSrc, title, sub }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2 }}
      className={
        "flex flex-col items-start gap-2 rounded border p-3 text-left transition-colors sm:p-4 " +
        (active
          ? "border-emerald bg-emerald-soft shadow-soft ring-2 ring-emerald/30"
          : "border-border bg-white hover:border-emerald/40 hover:shadow-soft dark:bg-card")
      }
    >
      <span className="relative flex h-9 w-9 items-center justify-center">
        <span
          className={
            "absolute inset-0 rounded transition-opacity duration-200 " +
            (active ? "bg-emerald/20 opacity-100" : "bg-secondary opacity-70")
          }
        />
        {iconSrc ? (
          <img src={iconSrc} alt="" className="relative h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(16,24,40,0.18)]" />
        ) : Icon ? (
          <Icon className="relative h-[22px] w-[22px] text-navy dark:text-foreground" strokeWidth={1.75} />
        ) : null}
      </span>
      <span className="font-heading text-[13px] font-bold leading-tight tracking-tight text-navy dark:text-foreground whitespace-nowrap sm:text-sm">{title}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </motion.button>
  );
}