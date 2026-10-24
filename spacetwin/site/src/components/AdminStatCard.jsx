import React from "react";

/**
 * Monochrome depth card: dark slate body, concentric radial glow behind the
 * icon corner, hairline inner highlight on the top edge. Accent tone only
 * bleeds through the glow + the number, so it never looks like a template card.
 */
const TONES = {
  amber:   { glow: "251 191 36", value: "text-amber-300" },
  emerald: { glow: "0 200 120",  value: "text-emerald-300" },
  rose:    { glow: "244 63 94",  value: "text-rose-300" },
  slate:   { glow: "148 163 184", value: "text-white" },
};

export default function AdminStatCard({ label, value, icon: Icon, tone = "slate" }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <div
      className="group relative isolate overflow-hidden rounded-[22px] bg-[#171a1f] px-4 pb-3.5 pt-4 transition-transform duration-300"
      style={{
        boxShadow:
          "inset 0 1px 0 rgb(255 255 255 / 0.10), inset 0 0 0 1px rgb(255 255 255 / 0.05), 0 18px 34px -22px rgb(0 0 0 / 0.95)",
      }}
    >
      {/* concentric glow rings anchored to the icon */}
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 rounded-full opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle, rgb(${t.glow} / 0.30) 0%, rgb(${t.glow} / 0.10) 42%, transparent 68%)` }}
      />
      <div
        className="pointer-events-none absolute -right-2 -top-3 h-20 w-20 rounded-full"
        style={{ background: `radial-gradient(circle, rgb(255 255 255 / 0.07) 0%, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between">
        <p className="font-heading text-[2rem] font-bold leading-none tracking-tight tabular-nums text-white">
          <span className={t.value}>{value}</span>
        </p>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#171a1f] shadow-lg">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <p className="relative mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <div
        className="relative mt-2 h-px w-full"
        style={{ background: `linear-gradient(to right, rgb(${t.glow} / 0.55), transparent)` }}
      />
    </div>
  );
}