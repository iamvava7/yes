import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/components/CountryContext";
import LocationAutocomplete from "@/components/LocationAutocomplete";

export default function SearchBar({ compact = false, onSubmitted }) {
  const { country, t } = useCountry();
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [zone, setZone] = useState("");
  const [type, setType] = useState("all");
  const [toggles, setToggles] = useState({});

  const types = [
    { value: "all", label: t("type_all_vc") },
    { value: "Garsonieră", label: t("type_studio_vc") },
    { value: "2 Camere", label: t("type_2_vc") },
    { value: "3 Camere", label: t("type_3_vc") },
    { value: "4+ Camere", label: t("type_4_vc") },
    { value: "Casă", label: t("type_house_vc") },
  ];
  // Filtrele rapide sunt TEXT, nu pastile cu iconițe de linie — alergia la
  // line-art e regulă de casă, iar cinci glife decorative pe eroul paginii
  // erau exact ce o încălca.
  const TOGGLES = [
    { key: "ai", label: t("tg_ai") },
    { key: "field", label: t("tg_field") },
    { key: "pet", label: t("tg_pet") },
    { key: "nofee", label: t("tg_nofee") },
    { key: "garant0", label: t("tg_garant0") },
  ];

  const toggle = (key) => setToggles((cur) => ({ ...cur, [key]: !cur[key] }));

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (zone) params.set("zone", zone);
    if (type && type !== "all") params.set("type", type);
    TOGGLES.forEach((tg) => { if (toggles[tg.key]) params.set(tg.key, "1"); });
    navigate(`/search?${params.toString()}`);
    onSubmitted?.();
  };

  const inputCls = "flex min-h-[46px] flex-1 items-center gap-2 rounded border border-border bg-card px-3 py-2.5";

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className={inputCls}>
          <LocationAutocomplete
            country={country}
            value={{ city, zone }}
            onSelect={({ city: c, zone: z }) => { setCity(c); setZone(z); }}
            placeholder={t("sb_city")}
            includeCounties={false}
            icon={MapPin}
            inputClassName="cursor-pointer"
          />
        </div>

        <div className="hidden h-8 w-px bg-border md:block" />

        <div className={inputCls}>
          <select value={type} onChange={(e) => setType(e.target.value)} className="vc-select vc-select-flush w-full cursor-pointer bg-transparent pr-6 text-sm text-foreground outline-none">
            {types.map((tp) => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
        </div>

        <Button type="submit" className="min-h-[46px] rounded bg-emerald text-primary-foreground hover:bg-emerald/90 md:px-7">
          {t("sb_btn")}
        </Button>
      </div>

      {/* Quick filter toggles */}
      {/* un singur rând derulabil pe telefon, se înfășoară de la md în sus */}
      <div className="no-scrollbar -mx-1 mt-2 flex items-center gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap">
        {TOGGLES.map((tg) => {
          const active = !!toggles[tg.key];
          return (
            <button
              key={tg.key}
              type="button"
              onClick={() => toggle(tg.key)}
              aria-pressed={active}
              className={`min-h-[38px] shrink-0 rounded border px-3 text-xs font-semibold transition-colors ${
                active
                  ? "border-emerald bg-emerald text-primary-foreground"
                  : "border-border bg-card text-foreground/75 hover:border-emerald"
              }`}
            >
              {tg.label}
            </button>
          );
        })}
      </div>
    </form>
  );
}