import React from "react";
import { MapPin } from "lucide-react";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import GooglePlacesAutocomplete from "@/components/GooglePlacesAutocomplete";
import { Field, inputCls } from "./wizardUi";
import { useWiz } from "./wizardCopy";

export default function StepLocation({ form, set, country }) {
  const { w } = useWiz();

  return (
    <div className="space-y-5">
      <Field label={w.l_city} required>
        <div className={inputCls}>
          <LocationAutocomplete
            country={country}
            value={{ city: form.city, zone: form.zone }}
            onSelect={({ city, zone }) => set({ city, zone })}
            placeholder={w.l_city_ph}
            includeCounties={false}
            icon={MapPin}
          />
        </div>
      </Field>

      <div className="rounded border border-emerald/30 bg-emerald-soft/40 p-4 dark:bg-emerald-soft/10">
        <p className="flex items-center gap-2 font-heading text-sm font-bold text-navy dark:text-foreground">
          <MapPin className="h-4 w-4 text-emerald" /> {w.l_map}
        </p>
        <GooglePlacesAutocomplete
          value={form.landmark}
          onChange={(v) => set({ landmark: v })}
          onPlace={(place) => set({
            landmark: place.name || form.landmark,
            latitude: place.lat != null ? place.lat : form.latitude,
            longitude: place.lng != null ? place.lng : form.longitude,
          })}
          placeholder={w.l_map_ph}
          className="mt-2 w-full rounded border border-emerald/50 bg-white px-3.5 py-3 text-base text-foreground outline-none focus:border-emerald dark:bg-card"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">{w.l_map_hint}</p>
      </div>
    </div>
  );
}
