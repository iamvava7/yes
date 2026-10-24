import React from "react";
import { Chip } from "./wizardUi";
import { CHIP_OPTS, FACILITY_OPTS, OPTION_OPTS, MIN_FEATURES, optLabel } from "@/lib/propertyPayload";
import { useWiz } from "./wizardCopy";
import { Check } from "lucide-react";

// Minim 3 bife pe pasul ăsta (cererea clientului) — contorul de aici doar
// arată unde ești; regula o impune wizardul, la Continuă și la Publică.
export const countFeatures = (chips, facilities, form) =>
  Object.values(chips).filter(Boolean).length +
  Object.values(facilities).filter(Boolean).length +
  OPTION_OPTS.filter((c) => !!form[c.key]).length;

const Group = ({ title, note, children }) => (
  <div>
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
    <div className="flex flex-wrap gap-2">{children}</div>
    {note && <p className="mt-1.5 text-[11px] text-muted-foreground/80">{note}</p>}
  </div>
);

export default function StepFeatures({ form, set, chips, setChips, facilities, setFacilities }) {
  const { w, en } = useWiz();
  const picked = countFeatures(chips, facilities, form);
  const enough = picked >= MIN_FEATURES;

  return (
    <div className="space-y-6">
      <p
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          enough ? "bg-emerald-soft text-emerald" : "bg-secondary text-muted-foreground"
        }`}
      >
        {enough && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        {w.f_picked(picked, MIN_FEATURES)}
        {enough && <span className="font-medium">· {w.f_picked_ok}</span>}
      </p>

      <Group title={w.f_verified} note={w.f_verified_note}>
        {CHIP_OPTS.map((c) => (
          <Chip key={c.key} icon={c.icon} label={optLabel(c, en)} active={!!chips[c.key]} onClick={() => setChips((s) => ({ ...s, [c.key]: !s[c.key] }))} />
        ))}
      </Group>

      <Group title={w.f_amenities}>
        {FACILITY_OPTS.map((c) => (
          <Chip key={c.key} icon={c.icon} label={optLabel(c, en)} active={!!facilities[c.key]} onClick={() => setFacilities((s) => ({ ...s, [c.key]: !s[c.key] }))} />
        ))}
      </Group>

      <Group title={w.f_options} note={w.f_options_note}>
        {OPTION_OPTS.map((c) => (
          <Chip key={c.key} icon={c.icon} label={optLabel(c, en)} active={!!form[c.key]} onClick={() => set({ [c.key]: !form[c.key] })} />
        ))}
      </Group>
    </div>
  );
}
