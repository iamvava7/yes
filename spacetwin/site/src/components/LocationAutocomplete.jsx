import React, { useState, useMemo, useRef, useEffect } from "react";
import { MapPin, Building2, LandPlot, LayoutGrid } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { searchLocations } from "@/components/locations";

const GROUP_META = {
  county: { label: "Județe", icon: LandPlot },
  city: { label: "Orașe", icon: Building2 },
  sector: { label: "Sectoare", icon: LayoutGrid },
  zone: { label: "Cartiere", icon: MapPin },
};

function Highlighted({ label, matchIndex, matchLen }) {
  if (matchIndex == null || matchIndex < 0 || !matchLen) return <>{label}</>;
  return (
    <>
      {label.slice(0, matchIndex)}
      <span className="text-emerald font-bold">{label.slice(matchIndex, matchIndex + matchLen)}</span>
      {label.slice(matchIndex + matchLen)}
    </>
  );
}

/**
 * Single search-as-you-type input for picking a județ / oraș / sector / cartier,
 * instead of scrolling two long <select> lists (Romania has 320 orașe). Typing
 * a few letters filters to matches across all four categories at once, grouped
 * and with the matched substring highlighted — matching is diacritic-insensitive.
 */
export default function LocationAutocomplete({
  country = "RO",
  value = { county: "", city: "", zone: "" },
  onSelect,
  placeholder = "Adaugă localități, zone",
  includeCounties = true,
  icon: Icon = MapPin,
  className = "",
  inputClassName = "",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const blurTimer = useRef(null);

  const displayLabel = value.zone
    ? `${value.zone} — ${value.city}`
    : value.city || (value.county ? `Județul ${value.county}` : "");

  const results = useMemo(
    () => searchLocations(country, query, { limitPerGroup: 6 }),
    [country, query]
  );

  const groupsToRender = useMemo(() => (
    [
      includeCounties && ["county", results.counties],
      ["city", results.cities],
      ["sector", results.sectors],
      ["zone", results.zones],
    ].filter(Boolean).filter(([, items]) => items.length)
  ), [results, includeCounties]);

  const flat = useMemo(() => groupsToRender.flatMap(([, items]) => items), [groupsToRender]);

  useEffect(() => { setActiveIdx(0); }, [query]);
  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const commit = (item) => {
    if (!item) return;
    if (item.type === "county") onSelect?.({ county: item.county, city: "", zone: "" });
    else if (item.type === "city") onSelect?.({ county: item.county, city: item.city, zone: "" });
    else onSelect?.({ county: item.county, city: item.city, zone: item.zone });
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (!open || !flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); commit(flat[activeIdx]); }
    else if (e.key === "Tab") { commit(flat[0]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const showPopover = open && query.trim().length > 0;
  let runningIdx = -1;

  return (
    <Popover open={showPopover}>
      <PopoverAnchor asChild>
        <div className={`relative flex items-center gap-2 ${className}`}>
          <Icon className="h-4 w-4 shrink-0 text-emerald" />
          <input
            ref={inputRef}
            value={open ? query : displayLabel}
            placeholder={placeholder}
            onFocus={(e) => { setOpen(true); setQuery(""); requestAnimationFrame(() => e.target.select?.()); }}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
            className={`w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground ${inputClassName}`}
            autoComplete="off"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="no-scrollbar max-h-80 w-[min(22rem,90vw)] overflow-y-auto p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {flat.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Niciun rezultat pentru „{query.trim()}”.
          </p>
        ) : (
          groupsToRender.map(([type, items]) => {
            const meta = GROUP_META[type];
            return (
              <div key={type} className="mb-1 last:mb-0">
                <p className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <meta.icon className="h-3 w-3" /> {meta.label}
                </p>
                {items.map((item) => {
                  runningIdx += 1;
                  const idx = runningIdx;
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={`${type}-${item.label}-${item.city || ""}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commit(item)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                        active ? "bg-emerald-soft text-navy" : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="truncate">
                        <Highlighted label={item.label} matchIndex={item.matchIndex} matchLen={query.trim().length} />
                      </span>
                      {(item.type === "city" && (
                        <span className="ml-2 shrink-0 truncate text-xs text-muted-foreground">Jud. {item.county}</span>
                      )) || ((item.type === "zone" || item.type === "sector") && (
                        <span className="ml-2 shrink-0 truncate text-xs text-muted-foreground">{item.city}</span>
                      ))}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}
