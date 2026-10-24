import React, { useState } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

// Single "Filters" button that opens a slide-up sheet with every search filter,
// so the results page keeps just one compact row.
//
// `compact` schimbă doar declanșatorul, nu și foaia: un buton rotund, doar cu
// pictograma, pentru cromul de peste hartă pe telefon — acolo o pastilă cu text
// mănâncă din hartă, care e tot ce vrea omul să vadă. Numărul de filtre active
// se mută pe o bulină din colț.
export default function SearchFiltersDrawer({
  t, filters, activeFilters, onToggle,
  planOptions, planFilters, onTogglePlan,
  budget, setBudget, roomsMin, setRoomsMin, surfaceMin, setSurfaceMin,
  fairness, setFairness, fairnessOptions, furnished, setFurnished,
  swap, setSwap, sort, setSort, sortOptions, onReset,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const count =
    activeFilters.size + (planFilters?.size || 0) +
    (budget ? 1 : 0) + (roomsMin ? 1 : 0) + (surfaceMin ? 1 : 0) +
    (fairness ? 1 : 0) + (furnished ? 1 : 0) + (swap ? 1 : 0);

  const field = "min-h-[44px] w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-emerald dark:bg-card";
  // `field` e folosit si de <input>, deci sageata proprie se adauga doar pe <select>.
  const selectField = "vc-select pr-10";
  // `active:` pe langa `hover:`, ca pastila sa raspunda si sub deget: pe telefon
  // `(hover: none)` face starea de hover sa nu existe deloc.
  const chip = (active) =>
    `tap-44 flex min-h-[36px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-200 ease-out active:scale-[0.95] ${
      active ? "border-emerald bg-emerald text-white shadow-soft" : "border-border bg-background text-foreground/70 hover:border-emerald/50 dark:bg-card"
    }`;

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("sr_advanced")}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-md transition-colors active:scale-[0.95] ${
            count > 0
              ? "border-emerald bg-emerald text-white"
              : "border-border bg-background text-foreground"
          }`}
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold leading-none text-background ring-2 ring-background tnum">
              {count}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={chip(count > 0)}
        >
          <SlidersHorizontal className="h-4 w-4" /> {t("sr_advanced")}
          {count > 0 && (
            <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-xs tnum">{count}</span>
          )}
        </button>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[88vh] rounded-t-3xl border-border px-4 pb-6 sm:pb-8">
          <DrawerTitle className="mt-4 px-1 font-heading text-base">{t("sr_advanced")}</DrawerTitle>

          <div className="no-scrollbar mt-4 space-y-5 overflow-y-auto px-1">
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button key={f.key} type="button" onClick={() => onToggle(f.key)} className={chip(activeFilters.has(f.key))}>
                  {t(f.labelKey)}
                </button>
              ))}
            </div>

            {planOptions?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Plan</p>
                <div className="flex flex-wrap gap-2">
                  {planOptions.map((opt) => (
                    <button key={opt.id} type="button" onClick={() => onTogglePlan(opt.id)} className={chip(planFilters?.has(opt.id))}>
                      {opt.icon && <img src={opt.icon} alt="" className="h-5 w-5 shrink-0 object-contain" />} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={t("ph_budget")} className={field} />
              <input type="number" value={surfaceMin} onChange={(e) => setSurfaceMin(e.target.value)} placeholder={t("sr_surface_min")} className={field} />
              <select value={roomsMin} onChange={(e) => setRoomsMin(e.target.value)} className={`${field} ${selectField}`}>
                <option value="">{t("sr_rooms_min")}</option>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{t("sr_rooms_option", { n })}</option>)}
              </select>
              <select value={fairness} onChange={(e) => setFairness(e.target.value)} className={`${field} ${selectField}`}>
                {fairnessOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${field} ${selectField} col-span-2`}>
                {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setFurnished((v) => !v)} className={chip(furnished)}>{t("furnished")}</button>
              <button type="button" onClick={() => setSwap((v) => !v)} className={chip(swap)}>{t("sr_swap")}</button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="min-h-[48px] flex-1 rounded-full border-border" onClick={onReset}>{t("sr_reset_filters")}</Button>
              <Button className="min-h-[48px] flex-1 gap-1.5 rounded-full bg-emerald text-primary-foreground hover:bg-emerald/90" onClick={() => setOpen(false)}>
                <Check className="h-4 w-4" /> {t("sb_btn")}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}