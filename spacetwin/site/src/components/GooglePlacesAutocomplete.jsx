import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Loader2 } from "lucide-react";

let keyPromise = null;
let scriptPromise = null;

function getKey() {
  if (!keyPromise) {
    keyPromise = (async () => {
      try {
        const res = await base44.functions.invoke("GetGoogleMapsKey", {});
        return res?.data?.key || res?.key || null;
      } catch {
        return null;
      }
    })();
  }
  return keyPromise;
}

function loadScript(key) {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) return resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("maps load failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Input necontrolat — Google Places Autocomplete scrie direct în DOM.
 * React nu mai luptă cu valoarea, deci câmpul nu se mai blochează la tastare.
 * Păstrează părțile informate despre schimbări via onChange/onPlace.
 */
export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlace,
  placeholder,
  className = "",
}) {
  const inputRef = useRef(null);
  const acRef = useRef(null);
  // refs ca listener-ul Google să folosească mereu callback-urile curente
  const onChangeRef = useRef(onChange);
  const onPlaceRef = useRef(onPlace);
  const [ready, setReady] = useState(false);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onPlaceRef.current = onPlace; }, [onPlace]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const key = await getKey();
      if (!alive) return;
      // Cheile valide pentru Maps JS API încep mereu cu "AIza…".
      // Orice alt format (ex. AQ.Ab…) e invalid → cădem pe text simplu,
      // altfel Google atașează un Autocomplete care blochează tastarea.
      if (!key || !key.startsWith("AIza")) { setNoKey(true); setReady(true); return; }
      try {
        await loadScript(key);
        if (!alive) return;
        if (!inputRef.current) return;
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["geocode"],
          fields: ["formatted_address", "geometry", "name", "address_components"],
        });
        acRef.current = ac;
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place || !place.geometry) return;
          const lat = place.geometry.location?.lat();
          const lng = place.geometry.location?.lng();
          const name = place.formatted_address || place.name || inputRef.current.value;
          // păstrează DOM-ul sincronizat cu textul selectat
          if (inputRef.current) inputRef.current.value = name;
          onChangeRef.current?.(name);
          onPlaceRef.current?.({
            name,
            lat: typeof lat === "number" ? lat : null,
            lng: typeof lng === "number" ? lng : null,
          });
        });
        setReady(true);
      } catch (e) {
        if (alive) { setNoKey(true); setReady(true); }
      }
    })();
    return () => {
      alive = false;
      if (acRef.current) {
        try { window.google?.maps?.event?.clearInstanceListeners?.(acRef.current); } catch {}
      }
    };
  }, []);

  // La prima montare (ex: formular de editare cu adresă existentă),
  // setează valoarea inițială în DOM fără să controlăm inputul.
  useEffect(() => {
    if (inputRef.current && value && !ready) {
      inputRef.current.value = value;
    }
  }, [value, ready]);

  return (
    <div className="relative w-full">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        defaultValue={value || ""}
        onBlur={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={`${className} pl-9`}
      />
      {!ready && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {noKey && (
        <p className="mt-1 text-[11px] text-amber-600">
          Google Maps key neconfigurat — adresa se tastează manual.
        </p>
      )}
    </div>
  );
}