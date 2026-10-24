import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Loader2 } from "lucide-react";

// Cheia de Google Maps e partajată cu GooglePlacesAutocomplete.
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
    if (window.google?.maps) return resolve();
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
 * Hartă Google Maps pentru pagina de proprietate.
 * - Dacă anunțul are lat/lng (alese din Google Maps la editare) → pinul
 *   cade exact pe adresa selectată.
 * - Altfel, geocodăm landmarkul / zona cu Google Geocoder → locație
 *   aproximativă, etichetată clar ca atare.
 */
export default function PropertyGoogleMap({ lat, lng, title, landmark, zone, city, t }) {
  const hasCoords =
    lat != null && lng != null && !Number.isNaN(+lat) && !Number.isNaN(+lng);
  const query = [landmark, zone, city, "România"].filter(Boolean).join(", ");
  // Adresa scrisă (landmark = stradă aleasă din Google Maps) e sursa de adevăr:
  // o geocodăm mereu, ca harta să corespundă cu ce vede utilizatorul în header.
  // Lat/lng vechi/păstrate pot fi învechite (ex: anunț mutat din Iași în Huși),
  // deci le folosim doar când nu există un landmark.
  const useGeocode = !!landmark || !hasCoords;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [exact, setExact] = useState(!!landmark || hasCoords);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const key = await getKey();
        if (!alive) return;
        if (!key || !key.startsWith("AIza")) {
          setStatus("error");
          return;
        }
        await loadScript(key);
        if (!alive || !containerRef.current) return;
        const g = window.google.maps;
        // Curăță orice instanță veche de hartă din container — altfel
        // google.maps.Map se stivuiește și harta anterioară (ex: Iași)
        // rămâne vizibilă peste cea nouă.
        if (containerRef.current) containerRef.current.innerHTML = "";
        mapRef.current = null;

        const renderAt = (position, isExact) => {
          const map = new g.Map(containerRef.current, {
            center: position,
            zoom: isExact ? 16 : 14,
            mapTypeControl: false,
            streetViewControl: true,
            fullscreenControl: true,
            zoomControl: true,
            gestureHandling: "cooperative",
          });
          mapRef.current = map;
          new g.Marker({ position, map, title });
          setExact(isExact);
          setStatus("ok");
        };

        if (useGeocode) {
          const geocoder = new g.Geocoder();
          geocoder.geocode({ address: query }, (results, status) => {
            if (!alive) return;
            if (status === "OK" && results && results[0]) {
              renderAt(results[0].geometry.location, !!landmark);
            } else {
              setStatus("error");
            }
          });
        } else {
          renderAt({ lat: +lat, lng: +lng }, true);
        }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
      if (mapRef.current) {
        try { window.google?.maps?.event?.clearInstanceListeners?.(mapRef.current); } catch {}
        mapRef.current = null;
      }
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [lat, lng, query, title, landmark, useGeocode]);

  return (
    <div className="relative h-56 w-full sm:h-72">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/60 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("map_load")}
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground bg-secondary/60">
          {t("map_unavail")}
        </div>
      )}
      {status === "ok" && (
        <div className="pointer-events-none absolute left-3 bottom-2 z-10 flex max-w-[88%] items-start gap-1 rounded-lg bg-white/95 px-2 py-1.5 text-[11px] font-medium text-emerald shadow-soft dark:bg-card/95">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{exact ? t("map_exact") : t("map_approx")}</span>
        </div>
      )}
    </div>
  );
}