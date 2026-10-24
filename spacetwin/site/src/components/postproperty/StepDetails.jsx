import React from "react";
import DateField from "@/components/DateField";
import { Field, inputCls } from "./wizardUi";
import { onlyDigits } from "@/lib/propertyPayload";
import { useWiz } from "./wizardCopy";

export default function StepDetails({ form, set }) {
  const { w } = useWiz();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={form.transaction_type === "SALE" ? w.d_price_sale : w.d_price_rent} required>
          <input type="number" inputMode="numeric" value={form.price_monthly} onChange={(e) => set({ price_monthly: e.target.value })} placeholder="450" className={inputCls} />
        </Field>
        <Field label={w.d_deposit}>
          <input type="number" inputMode="numeric" value={form.deposit} onChange={(e) => set({ deposit: e.target.value })} placeholder="450" className={inputCls} />
        </Field>
        <Field label={w.d_rooms} required>
          <input type="number" inputMode="numeric" value={form.rooms} onChange={(e) => set({ rooms: e.target.value })} className={inputCls} />
        </Field>
        <Field label={w.d_surface} required>
          <input type="number" inputMode="numeric" value={form.surface_sqm} onChange={(e) => set({ surface_sqm: e.target.value })} placeholder="52" className={inputCls} />
        </Field>
        <Field label={w.d_floor} hint={w.d_floor_hint}>
          <input value={form.floor} onChange={(e) => set({ floor: e.target.value })} placeholder="3" className={inputCls} />
        </Field>
        <Field label={w.d_total_floors}>
          <input inputMode="numeric" value={form.total_floors} onChange={(e) => set({ total_floors: onlyDigits(e.target.value, 3) })} placeholder="10" className={inputCls} />
        </Field>
        <Field label={w.d_year} required>
          <input inputMode="numeric" value={form.building_year} onChange={(e) => set({ building_year: onlyDigits(e.target.value, 4) })} placeholder="2005" className={inputCls} />
        </Field>
        <Field label={w.d_available} required>
          <DateField value={form.available_from} onChange={(e) => set({ available_from: e.target.value })} placeholder={w.d_available} className="w-full" />
        </Field>
      </div>

      <Field label={w.d_desc} required hint={w.d_desc_hint}>
        <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={4} placeholder={w.d_desc_ph} className={inputCls} />
      </Field>
    </div>
  );
}
