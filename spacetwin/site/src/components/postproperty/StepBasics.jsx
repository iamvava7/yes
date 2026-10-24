import React from "react";
import { DoorOpen, BedSingle, BedDouble, Building2, Home, Building } from "lucide-react";
import { Field, ChoiceCard, inputCls } from "./wizardUi";
import { useWiz, PROPERTY_TYPE_EN } from "./wizardCopy";

// `v` e valoarea SALVATĂ în property_type și rămâne în română oricare ar fi
// limba interfeței — se traduce doar ce se vede.
const TYPES = [
  { v: "Garsonieră", icon: DoorOpen }, { v: "2 Camere", icon: BedSingle }, { v: "3 Camere", icon: BedDouble },
  { v: "4+ Camere", icon: Building2 }, { v: "Casă", icon: Home }, { v: "Studio", icon: Building },
];

export default function StepBasics({ form, set }) {
  const { w, en } = useWiz();

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{w.b_intent}</p>
        <div className="grid grid-cols-2 gap-3">
          <ChoiceCard iconSrc="/images/generated/icon-key.png" title={w.b_rent} sub={w.b_rent_sub} active={form.transaction_type === "RENT"} onClick={() => set({ transaction_type: "RENT" })} />
          <ChoiceCard iconSrc="/images/generated/icon-coins.png" title={w.b_sale} sub={w.b_sale_sub} active={form.transaction_type === "SALE"} onClick={() => set({ transaction_type: "SALE" })} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{w.b_type}</p>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((tp) => (
            <ChoiceCard
              key={tp.v}
              icon={tp.icon}
              title={en ? (PROPERTY_TYPE_EN[tp.v] || tp.v) : tp.v}
              active={form.property_type === tp.v}
              onClick={() => set({ property_type: tp.v })}
            />
          ))}
        </div>
      </div>

      <Field label={w.b_title} required hint={w.b_title_hint}>
        <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={w.b_title_ph} className={inputCls} />
      </Field>
    </div>
  );
}
