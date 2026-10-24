import React from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Fișa de Inspecție — the registry primitive layer.
   Every verdict is a stamp (bordered, dated, attributed), never a coloured
   pill. Facts live in ruled ledgers with tabular figures. Mono type exists
   only as instrument marks drawn ON photographs (PhotoMark / Viewfinder).
--------------------------------------------------------------------------- */

/** Bordered verdict stamp. tone: verde | gold | ink | marcaj */
export function Stamp({ tone = "verde", date, by, className, children }) {
  const toneCls = {
    verde: "",
    gold: "vc-stamp--gold",
    ink: "vc-stamp--ink",
    marcaj: "vc-stamp--marcaj",
  }[tone];
  return (
    <span className={cn("vc-stamp", toneCls, className)}>
      <span>{children}</span>
      {date && <span className="font-medium opacity-80">· {date}</span>}
      {by && <span className="font-medium opacity-80">· {by}</span>}
    </span>
  );
}

/** Franking mark for boosted listings: PROMOVAT · exp. date. Disclosed paid placement. */
export function Frank({ until, className }) {
  return (
    <span className={cn("vc-stamp vc-stamp--gold", className)} title="Poziție promovată (plătită)">
      <span>Promovat</span>
      {until && <span className="font-medium opacity-80">· exp. {until}</span>}
    </span>
  );
}

/** Quiet section label. Hanken, never mono, never uppercase-tracked wallpaper. */
export function Kicker({ className, children }) {
  return (
    <p className={cn("text-[13px] font-semibold text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** Hairline rule. */
export function Hairline({ className }) {
  return <div className={cn("h-px w-full bg-border", className)} aria-hidden="true" />;
}

/** Ruled fact ledger. Children are LedgerRow. */
export function Ledger({ className, children }) {
  return <dl className={cn("divide-y divide-border border-y border-border", className)}>{children}</dl>;
}

export function LedgerRow({ label, value, sub, className }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2.5", className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-semibold tnum">
        {value}
        {sub && <span className="ml-1.5 font-normal text-muted-foreground">{sub}</span>}
      </dd>
    </div>
  );
}

/** Trust score mark: the number set as a stamped figure with its scale. */
export function ScoreMark({ score, size = "md", className }) {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const band = s >= 75 ? "text-emerald border-emerald" : s >= 40 ? "text-foreground border-foreground/60" : "text-muted-foreground border-border";
  const sz = size === "lg" ? "text-2xl px-3 py-1.5" : "text-base px-2 py-1";
  return (
    <span className={cn("inline-flex items-baseline gap-1 rounded-full border-[1.5px] font-heading font-semibold tnum", band, sz, className)}>
      {s}
      <span className="text-[0.6em] font-body font-semibold text-muted-foreground">/100</span>
    </span>
  );
}

/** Allowance meter row: label, used/limit, thin bar. For Contul meu limits. */
export function Meter({ label, used = 0, limit, unlimited = false, reset, className }) {
  const pct = unlimited || !limit ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const over = !unlimited && limit && used >= limit;
  return (
    <div className={cn("py-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-semibold tnum", over && "text-destructive")}>
          {unlimited ? "nelimitat" : `${used} / ${limit}`}
        </p>
      </div>
      {!unlimited && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-emerald")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {reset && <p className="mt-1 text-xs text-muted-foreground">{reset}</p>}
    </div>
  );
}

/**
 * The score, shown with its working. Bands come from the ComputeTrustScore
 * breakdown; a listing that scores badly shows WHY, deductions included, and
 * what would raise it. Falls back to the bare figure while a listing has no
 * stored breakdown yet.
 *
 * Verdictele sunt despre COMPLETITUDINE, nu despre verificare. Scorul e de
 * completitudine (v3) și un anunț bine completat ajunge singur la 80 din 100,
 * deci un verdict „Verificat" la 40 ar fi fost o afirmație pe care nimeni din
 * afară nu a confirmat-o.
 */
export function ScoreLedger({ score, breakdown, className, labels = {} }) {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const verdict = s >= 75 ? (labels.high || "Anunț complet") : s >= 40 ? (labels.mid || "Parțial completat") : (labels.low || "Incomplet");
  const tone = s >= 75 ? "verde" : "ink";
  const bands = Array.isArray(breakdown?.bands) ? breakdown.bands : [];
  const deductions = Array.isArray(breakdown?.deductions) ? breakdown.deductions : [];
  const missing = Array.isArray(breakdown?.missing) ? breakdown.missing : [];

  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold text-foreground">
            {labels.title || "Scor de încredere"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {labels.sub || "Calculat din dovezi, nu din câte poze ai încărcat."}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-3xl font-semibold leading-none text-foreground tnum">
            {s}<span className="font-body text-sm font-medium text-muted-foreground">/100</span>
          </p>
          <span
            className={cn(
              "mt-1.5 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
              tone === "verde" ? "bg-emerald-soft text-emerald" : "bg-secondary text-muted-foreground",
            )}
          >
            {verdict}
          </span>
        </div>
      </div>

      {bands.length > 0 ? (
        <div className="px-4 py-1">
          <Ledger className="border-y-0">
            {bands.map((b) => (
              <div key={b.key || b.label} className="py-2.5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-semibold text-foreground">{b.label}</p>
                  <p className="text-sm font-semibold tnum">
                    {b.points}<span className="font-normal text-muted-foreground">/{b.max}</span>
                  </p>
                </div>
                {b.reason && <p className="mt-0.5 max-w-[62ch] text-xs text-muted-foreground">{b.reason}</p>}
              </div>
            ))}
            {deductions.map((d) => (
              <div key={d.key || d.label} className="py-2.5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-semibold text-marcaj">{d.label}</p>
                  <p className="text-sm font-semibold text-marcaj tnum">−{Math.abs(d.points)}</p>
                </div>
                {d.reason && <p className="mt-0.5 max-w-[62ch] text-xs text-muted-foreground">{d.reason}</p>}
              </div>
            ))}
          </Ledger>

          {/* Ce ar ridica scorul. Fără asta, un scor de completitudine e doar o
              cifră care te judecă fără să-ți spună ce să faci. */}
          {missing.length > 0 && (
            <div className="border-t border-border py-3">
              <p className="text-xs font-semibold text-foreground">
                {labels.missing || "Ce ar ridica scorul"}
              </p>
              <p className="mt-1 max-w-[62ch] text-xs text-muted-foreground">
                {missing.join(" · ")}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          {labels.pending || "Detalierea scorului se publică la următoarea recalculare a anunțului."}
        </p>
      )}
    </section>
  );
}

/* ---- instrument marks ON photographs (the only home of mono type) ---- */

/** Mono annotation positioned on an image. Parent must be relative. */
export function PhotoMark({ className, children }) {
  return <span className={cn("vc-photomark absolute", className)}>{children}</span>;
}

/** Viewfinder corner brackets over an image. Parent must be relative. */
export function Viewfinder({ className, inset = "0.625rem", stroke = "rgba(255,255,255,0.85)" }) {
  const c = { position: "absolute", width: "1.1rem", height: "1.1rem", borderColor: stroke };
  const b = "2px solid";
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden="true">
      <span style={{ ...c, top: inset, left: inset, borderTop: b, borderLeft: b, borderColor: stroke }} className="absolute" />
      <span style={{ ...c, top: inset, right: inset, borderTop: b, borderRight: b, borderColor: stroke }} className="absolute" />
      <span style={{ ...c, bottom: inset, left: inset, borderBottom: b, borderLeft: b, borderColor: stroke }} className="absolute" />
      <span style={{ ...c, bottom: inset, right: inset, borderBottom: b, borderRight: b, borderColor: stroke }} className="absolute" />
    </div>
  );
}
