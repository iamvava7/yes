import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer, TileLayer, Marker, Tooltip, Polygon, CircleMarker,
  useMap, useMapEvents,
} from "react-leaflet";
import { base44 } from "@/api/base44Client";
import { useCountry } from "@/components/CountryContext";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import PropertyCard from "@/components/PropertyCard";
import { buildCoverMap } from "@/lib/covers";
import MapCardRail from "@/components/MapCardRail";
import MapInfoCards from "@/components/MapInfoCards";
import SearchFiltersDrawer from "@/components/SearchFiltersDrawer";
import { getCounty } from "@/components/locations";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Heart, X, ArrowLeft, Plus, Minus, PenLine, Trash2, Check,
  Search, Home, Sparkles, ShieldCheck, PawPrint, BadgePercent, RotateCcw,
  ChevronLeft, Layers, List,
} from "lucide-react";
import { ROMANIA_COUNTIES } from "@/lib/romaniaCounties";
import { ROMANIA_OUTLINE, ROMANIA_BOUNDS, ROMANIA_MAX_BOUNDS, MASK_RING } from "@/lib/romaniaOutline";
import { resolvePropertyPlan, PLAN_FILTER_OPTIONS, compareByBoostThenViews } from "@/lib/plans";
import { fetchActivePlanMap } from "@/lib/subscriptions";

// Aceleași filtre ca pe /search — reutilizate 1:1 aici ca lista și harta
// să răspundă la exact aceleași criterii, indiferent de unde intri.
const VERIF_FILTERS = [
  { key: "ai", labelKey: "tg_ai", icon: Sparkles, test: (p) => !!p.tour_3d_url || !!p.ai_video_url || !!p.ai_tour_verified },
  { key: "field", labelKey: "tg_field", icon: ShieldCheck, test: (p) => p.owner_verified || p.verification_level === "field_certified" || p.ai_tour_verified },
  { key: "pet", labelKey: "tg_pet", icon: PawPrint, test: (p) => !!p.pet_friendly },
  { key: "nofee", labelKey: "tg_nofee", icon: BadgePercent, test: (p) => !!p.commission_free },
  { key: "studio", labelKey: "type_studio_vc", icon: Home, test: (p) => ["Garsonieră", "Studio"].includes(p.property_type) },
  { key: "2camere", labelKey: "type_2_vc", icon: Home, test: (p) => p.property_type === "2 Camere" },
  { key: "parking", labelKey: "sr_parking", icon: Home, test: (p) => !!p.parking },
];
const makeFairness = (t) => [
  { value: "", label: t("sr_fairness_all") },
  { value: "sub_piata", label: t("sr_fairness_below") },
  { value: "corect", label: t("sr_fairness_fair") },
  { value: "peste_medie", label: t("sr_fairness_above") },
];
const makeSort = (t) => [
  { value: "", label: t("sr_sort") },
  { value: "newest", label: t("sr_sort_newest") },
  { value: "price_asc", label: t("sr_sort_asc") },
  { value: "price_desc", label: t("sr_sort_desc") },
];
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const PAGE_SIZE = 5;
// Câte carduri intră în banda de pe telefon. Peste atât, se trece la listă —
// nimeni nu trage prin 200 de carduri cu degetul.
const RAIL_MAX = 24;
// Podeaua de la care RomaniaLock remăsoară zoom-ul minim la fiecare
// redimensionare. Nu se vede niciodată: limita reală o pune tot el, imediat.
const FLOOR_ZOOM = 3;

function formatCount(n) {
  if (n >= 1000) {
    const k = (n / 1000).toFixed(1);
    return (k.endsWith(".0") ? k.slice(0, -2) : k) + "K";
  }
  return String(n);
}

// Preț scurt pentru ștampila de pe hartă: 1.250 € / 89 K € — cifre tabulare,
// fără zecimale, ca ștampilele să aibă lățimi comparabile între ele.
function stampPrice(p) {
  const n = Number(p.price_monthly) || 0;
  const sym = p.currency === "RON" ? "lei" : p.currency === "GBP" ? "£" : "€";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(".0", "")}M ${sym}`;
  if (n >= 10000) return `${Math.round(n / 1000)}K ${sym}`;
  return `${n.toLocaleString("ro-RO")} ${sym}`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Leaflet path options iau culori concrete, nu variabile CSS — citim tokenul
// temei o dată, ca poligonul desenat să rămână verde în ambele teme.
function tokenColor(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : fallback;
}

function readMapColors() {
  return {
    draw: tokenColor("--primary", "#1F7048"),
    // Masca ia culoarea hârtiei paginii, nu un gri oarecare: afară de graniță
    // nu e „hartă întunecată”, e pagină goală.
    mask: tokenColor("--background", "#FAF8F3"),
    border: tokenColor("--primary", "#1F7048"),
  };
}

// Culorile hărții, recitite când comută tema.
//
// Prima variantă asculta `resolvedTheme` de la next-themes și rămânea cu o
// comutare în urmă: ThemeProvider e strămoș, deci efectul LUI (cel care pune
// clasa `dark` pe <html>) rulează DUPĂ efectul paginii, așa că citeam tokenii
// vechi. Aici ne uităm direct la ce s-a scris pe <html> — nu depinde de
// ordinea efectelor și prinde orice cale prin care se schimbă tema.
function useMapColors() {
  const [colors, setColors] = useState(readMapColors);

  useEffect(() => {
    const sync = () => setColors((prev) => {
      const next = readMapColors();
      const same = next.draw === prev.draw && next.mask === prev.mask && next.border === prev.border;
      return same ? prev : next;
    });
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => obs.disconnect();
  }, []);

  return colors;
}

// Iconițele se ȚIN ÎN CACHE, nu se construiesc la fiecare randare.
//
// Aici era cauza baloanelor cu titlu rămase stivuite peste hartă. react-leaflet
// compară `icon` prin IDENTITATE: un `L.divIcon` proaspăt la fiecare randare
// înseamnă `marker.setIcon()` pe TOATE pinurile, la orice schimbare de stare —
// inclusiv la simpla trecere cu mouse-ul peste unul singur. Leaflet șterge
// atunci elementul de sub cursor și pune altul; cursorul nu mai poate ieși de pe
// cel vechi, fiindcă nu mai există, deci `mouseout` nu se produce niciodată și
// balonul rămâne deschis pentru totdeauna. Un balon în plus la fiecare pin
// atins, exact ce se vedea în captură.
//
// Cheia conține tot ce se vede în iconiță; două stări identice primesc același
// obiect, deci react-leaflet nu mai atinge DOM-ul degeaba.
const iconCache = new Map();
function cachedIcon(key, build) {
  let icon = iconCache.get(key);
  if (!icon) {
    // Plafon: harta are câteva sute de combinații vizuale, nu mii. Dacă totuși
    // se umple (multe prețuri distincte), o golim și se reconstruiește leneș.
    if (iconCache.size > 1500) iconCache.clear();
    icon = build();
    iconCache.set(key, icon);
  }
  return icon;
}

// Grup de anunțuri = marcă de fascicul: pătrat, cu un al doilea contur, cifre
// tabulare. Nu cerc, nu gradient — vezi .vc-bundle în index.css. Starea de sub
// cursor o face CSS-ul (.vc-bundle:hover), nu React: dacă ar veni din stare,
// iconița s-ar reconstrui chiar sub deget — vezi cachedIcon.
// `iconSize: null` peste tot, intenționat: învelișul e un PUNCT fără dimensiune,
// fixat pe coordonată, iar bula se așază față de el din CSS (translate -50%).
// Înainte lățimea era ESTIMATĂ aici, ca Leaflet să poată pune ancora la mijloc,
// iar estimarea greșea cu până la 9px — adică vârful bulei arăta pe lângă casă.
// Acum nu mai există nicio formulă de ținut sincronizată cu foaia de stil.
function clusterIcon(count) {
  return cachedIcon(`bundle|${count}`, () =>
    L.divIcon({
      className: "vc-bundle-wrap",
      html: `<span class="vc-bundle">${formatCount(count)}</span>`,
      iconSize: null,
      iconAnchor: [0, 0],
    })
  );
}

// Anunț = ștampilă de preț. Bifa verde marchează verificarea, iar un anunț
// promovat poartă cuvântul scris — „Promovat" pe o pastilă aurie. Culoarea
// singură nu spunea nimic cuiva care nu știe codul; clientul a cerut textul.
// Starea activă (cardul din listă / din bandă peste care treci) se inversează
// pe verde. Toate culorile vin din tokenii temei.
function propertyIcon(property, { isActive = false, isVisited = false, en = false } = {}) {
  const verified =
    property.owner_verified ||
    property.verification_level === "field_certified" ||
    property.ai_tour_verified;
  const boosted = property.boost_active || property.featured;
  const label = stampPrice(property);
  // Același cuvânt ca pe insigna de pe card — vezi PropertyBadges.
  const promo = boosted ? (en ? "Promoted" : "Promovat") : "";

  return cachedIcon(
    `pin|${label}|${verified ? 1 : 0}|${promo}|${isActive ? 1 : 0}|${isVisited ? 1 : 0}`,
    () => {
      const cls = [
        "vc-pin",
        isActive ? "vc-pin--active" : "",
        !isActive && isVisited ? "vc-pin--visited" : "",
        boosted ? "vc-pin--boosted" : "",
      ].filter(Boolean).join(" ");
      return L.divIcon({
        className: "vc-pin-wrap",
        html:
          `<span class="${cls}">${esc(label)}` +
          (verified ? '<span class="vc-pin-tick">✓</span>' : "") +
          (promo ? `<span class="vc-pin-promo">${esc(promo)}</span>` : "") +
          `</span>`,
        iconSize: null,
        iconAnchor: [0, 0],
      });
    }
  );
}

function countyLabelIcon(name) {
  return cachedIcon(`county|${name}`, () =>
    L.divIcon({
      className: "vc-county-label",
      html: `<span class="vc-maplabel">${esc(name)}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    })
  );
}

// Există cursor? Nu „e ecran mic?" — un laptop cu ecran îngust are cursor, o
// tabletă lată nu are. Baloanele de pe hartă atârnă de asta.
function useCanHover() {
  const [can, setCan] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover)");
    const on = () => setCan(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return can;
}

function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1], yi = polygon[i][0];
    const xj = polygon[j][1], yj = polygon[j][0];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Harta e a României, deci nu se poate ieși din România.
//
// `maxBounds` singur nu ajungea: el ține CENTRUL în cutie, iar la zoom mic un
// ecran lat încape jumătate de Europă în jurul ei — exact ce se vedea în
// captura clientului. Aici calculăm zoom-ul la care țara umple cadrul și îl
// facem zoom MINIM, recalculat la fiecare redimensionare (rotirea telefonului,
// deschiderea listei pe desktop). Restul — fâșiile rămase pe laturi când
// raportul ecranului nu se potrivește cu al țării — le stinge masca.
function RomaniaLock() {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds(ROMANIA_BOUNDS);
    const apply = () => {
      // `getBoundsZoom` își taie singur rezultatul la zoom-ul minim CURENT, deci
      // dacă măsurăm fără să-l coborâm întâi, limita nu poate decât să urce:
      // rotești telefonul într-un cadru mai mic, iar harta rămâne blocată la
      // zoom-ul cadrului mare. Coborâm limita, măsurăm, apoi o punem la loc.
      map.setMinZoom(FLOOR_ZOOM);
      // `inside: false` = "toată țara să încapă în cadru". Cu `true` ar cere ca
      // tot cadrul să fie în interiorul cutiei, iar pe un ecran de telefon
      // (înalt și îngust) asta ar însemna că țara nu se poate vedea întreagă
      // niciodată.
      const fit = map.getBoundsZoom(bounds, false);
      if (!Number.isFinite(fit)) return;
      map.setMinZoom(fit);
      if (map.getZoom() < fit) map.setZoom(fit);
    };
    apply();
    map.on("resize", apply);
    return () => map.off("resize", apply);
  }, [map]);

  return null;
}

// Cel mult UN balon deschis, oricând — plasa de siguranță sub cachedIcon.
//
// Leaflet nu impune asta singur: fiecare strat își deschide și își închide
// propriul balon, iar dacă unul ratează `mouseout` rămâne pe hartă la nesfârșit.
// Aici ținem minte cine e deschis, îl închidem când se deschide altul, și
// închidem tot la prima mișcare a hărții.
function TooltipGuard() {
  const map = useMap();

  useEffect(() => {
    let openLayer = null;
    const sourceOf = (e) => e.layer || e.tooltip?._source || null;

    const onOpen = (e) => {
      const src = sourceOf(e);
      if (openLayer && openLayer !== src) openLayer.closeTooltip?.();
      openLayer = src;
    };
    const onClose = (e) => {
      if (openLayer && openLayer === sourceOf(e)) openLayer = null;
    };
    const closeOpen = () => {
      openLayer?.closeTooltip?.();
      openLayer = null;
    };

    map.on("tooltipopen", onOpen);
    map.on("tooltipclose", onClose);
    map.on("movestart zoomstart", closeOpen);
    return () => {
      map.off("tooltipopen", onOpen);
      map.off("tooltipclose", onClose);
      map.off("movestart zoomstart", closeOpen);
    };
  }, [map]);

  return null;
}

function MapController({ onBoundsChange, onZoomChange, flyTarget, onFlyDone, onReady }) {
  const map = useMap();

  useEffect(() => {
    onReady?.(map);
    const b = map.getBounds();
    const c = map.getCenter();
    onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest(), lat: c.lat, lng: c.lng });
    onZoomChange(map.getZoom());
     
  }, [map]);

  useEffect(() => {
    if (flyTarget) {
      map.flyTo([flyTarget.lat, flyTarget.lng], flyTarget.zoom || 10, { duration: 0.8 });
      onFlyDone();
    }
     
  }, [flyTarget, map]);

  useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      const c = map.getCenter();
      onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest(), lat: c.lat, lng: c.lng });
    },
    zoomend: () => {
      onZoomChange(map.getZoom());
      const b = map.getBounds();
      const c = map.getCenter();
      onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest(), lat: c.lat, lng: c.lng });
    },
  });

  return null;
}

function DrawController({ drawMode, onAddPoint }) {
  useMapEvents({
    click: (e) => {
      if (drawMode) onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function MapSearch() {
  const { country, lang, t } = useCountry();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const en = lang === "en";

  // Filtre unificate — aceleași ca pe /search, sincronizate cu URL-ul, astfel
  // încât harta și lista de rezultate răspund la exact aceleași criterii.
  const [params, setParams] = useSearchParams();
  const cityParam = params.get("city") || "";
  const zoneParam = params.get("zone") || "";
  const countyParam = params.get("county") || "";
  const typeParam = params.get("type") || "";
  const qParam = params.get("q") || "";
  const [budget, setBudget] = useState("");
  const [roomsMin, setRoomsMin] = useState("");
  const [surfaceMin, setSurfaceMin] = useState("");
  const [furnished, setFurnished] = useState(false);
  const [swap, setSwap] = useState(false);
  const [fairness, setFairness] = useState("");
  const [sort, setSort] = useState("");
  const [activeFilters, setActiveFilters] = useState(() => {
    const s = new Set();
    VERIF_FILTERS.forEach((f) => { if (params.get(f.key) === "1") s.add(f.key); });
    return s;
  });
  const [planFilters, setPlanFilters] = useState(() => {
    const raw = params.get("plan");
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  });

  const updateLocation = ({ county, city, zone }) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (city) next.set("city", city); else next.delete("city");
    if (zone) next.set("zone", zone); else next.delete("zone");
    if (!city && county) next.set("county", county); else next.delete("county");
    return next;
  }, { replace: true });
  const setQ = (v) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (v) next.set("q", v); else next.delete("q");
    return next;
  }, { replace: true });
  const toggleFilter = (key) => {
    setActiveFilters((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      const next = new URLSearchParams(params);
      if (n.has(key)) next.set(key, "1"); else next.delete(key);
      setParams(next, { replace: true });
      return n;
    });
  };
  const togglePlan = (id) => {
    setPlanFilters((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      const next = new URLSearchParams(params);
      if (n.size > 0) next.set("plan", Array.from(n).join(",")); else next.delete("plan");
      setParams(next, { replace: true });
      return n;
    });
  };
  const resetFilters = () => {
    setBudget(""); setRoomsMin(""); setSurfaceMin("");
    setFurnished(false); setSwap(false); setFairness(""); setSort("");
    setActiveFilters(new Set());
    setPlanFilters(new Set());
    setParams(new URLSearchParams(), { replace: true });
  };

  const [properties, setProperties] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(6);
  const [flyTarget, setFlyTarget] = useState(null);
  // DOUĂ stări de survolare, nu una, și diferența contează.
  //
  // `hoveredKey` vine din LISTĂ / din bandă și aprinde pinul de pe hartă — adică
  // schimbă iconița. `pinHoverId` vine din HARTĂ și aprinde doar cardul din
  // listă. Dacă și survolarea pinului ar trece prin iconiță, Leaflet ar
  // reconstrui elementul chiar sub cursor și balonul cu titlu ar rămâne agățat
  // (vezi cachedIcon). Pinul de sub cursor își face singur starea, din CSS.
  const [hoveredKey, setHoveredKey] = useState(null);
  const [pinHoverId, setPinHoverId] = useState(null);
  const canHover = useCanHover();
  const [showListMobile, setShowListMobile] = useState(false);
  // Pe telefon, anunțul ales nu mai deschide un panou peste hartă: aduce banda
  // de jos la cardul lui. Ținem doar id-ul.
  const [selectedId, setSelectedId] = useState(null);
  const [railOpen, setRailOpen] = useState(true);
  const [mapInstance, setMapInstance] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [planMap, setPlanMap] = useState(null);
  // Fișa de teren: fundal PLAN / SATELIT, colțuri cu coordonatele vii, scară.
  const [basemap, setBasemap] = useState("plan");
  // Anunțurile deja deschise se sting pe hartă — vezi .vc-pin--visited.
  const [visitedIds, setVisitedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("vc_visited_props") || "[]")); }
    catch { return new Set(); }
  });

  // Cheia CARTO pentru basemaps (ridică rate-limit-ul pe tile-urile gratuite).
  // Lipsa ei nu strică harta: CDN-ul public cartocdn servește și fără ea.
  const [mapKey, setMapKey] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke("GetMapKey", {});
        if (!cancelled && res?.key) setMapKey(res.key);
      } catch { /* harta merge și fără cheie */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Leaflet primește culori concrete, nu tokeni CSS — vezi useMapColors.
  const mapColors = useMapColors();
  const drawColor = mapColors.draw;

  const markVisited = useCallback((id) => {
    if (!id) return;
    setVisitedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem("vc_visited_props", JSON.stringify([...next].slice(-300))); } catch { /* noop */ }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [all, map] = await Promise.all([
          base44.entities.Property.filter(
            { approval_status: "APPROVED", status: "Activ", country: "RO" },
            "-views_count",
            500
          ),
          fetchActivePlanMap(),
        ]);
        if (!cancelled) { setProperties(all); setPlanMap(map); }
      } catch (e) {
        if (!cancelled) { setProperties([]); setPlanMap(new Map()); }
      }
    })();

    // Realtime: new/updated/deleted properties appear on the map instantly
    const unsubscribe = base44.entities.Property.subscribe((event) => {
      const p = event.data;
      setProperties((prev) => {
        if (!prev) return prev;
        if (event.type === "delete") return prev.filter((x) => x.id !== event.id);
        if (!p) return prev;
        const matches = p.approval_status === "APPROVED" && p.status === "Activ" && p.country === "RO";
        if (!matches) return prev.filter((x) => x.id !== p.id);
        const idx = prev.findIndex((x) => x.id === p.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = p;
          return next;
        }
        return [p, ...prev];
      });
    });

    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const geoProps = useMemo(
    () => (properties || []).filter((p) => p.latitude && p.longitude),
    [properties]
  );

  // Aceleași criterii ca pe /search, aplicate înainte de filtrarea geografică
  // (bounds/poligon) — harta și lista arată mereu aceleași rezultate.
  const filteredGeoProps = useMemo(() => {
    return geoProps.filter((p) => {
      if (cityParam && !norm(p.city).includes(norm(cityParam))) return false;
      if (zoneParam && !norm(`${p.zone || ""} ${p.landmark || ""}`).includes(norm(zoneParam))) return false;
      if (countyParam && norm(getCounty(p.city)) !== norm(countyParam)) return false;
      if (typeParam && p.property_type !== typeParam) return false;
      if (qParam) {
        const hay = norm([p.title, p.zone, p.city, p.landmark, p.description, p.property_type, p.property_code].join(" "));
        if (!hay.includes(norm(qParam))) return false;
      }
      for (const f of VERIF_FILTERS) {
        if (activeFilters.has(f.key) && !f.test(p)) return false;
      }
      if (planFilters.size > 0) {
        const plan = resolvePropertyPlan(p, planMap) || "none";
        if (!planFilters.has(plan)) return false;
      }
      if (budget) { const max = parseInt(budget, 10); if (!isNaN(max) && p.price_monthly > max) return false; }
      if (roomsMin) { const r = parseInt(roomsMin, 10); if (!isNaN(r) && (p.rooms == null || p.rooms < r)) return false; }
      if (surfaceMin) { const s = parseFloat(surfaceMin); if (!isNaN(s) && (p.surface_sqm == null || p.surface_sqm < s)) return false; }
      if (furnished && !p.furnished) return false;
      if (swap && !p.is_swap_available) return false;
      if (fairness && p.price_fairness !== fairness) return false;
      return true;
    });
  }, [geoProps, cityParam, zoneParam, countyParam, typeParam, qParam, activeFilters, planFilters, planMap, budget, roomsMin, surfaceMin, furnished, swap, fairness]);

  const clusters = useMemo(() => {
    if (!filteredGeoProps.length) return [];
    if (zoom < 8) {
      const byCounty = {};
      filteredGeoProps.forEach((p) => {
        const county = p.county || "Altele";
        if (!byCounty[county]) byCounty[county] = { count: 0, lat: 0, lng: 0, n: 0, county, type: "county" };
        byCounty[county].count++;
        const center = ROMANIA_COUNTIES.find((c) => c.name === county);
        if (center) {
          byCounty[county].lat = center.lat;
          byCounty[county].lng = center.lng;
        } else {
          byCounty[county].lat += p.latitude;
          byCounty[county].lng += p.longitude;
          byCounty[county].n++;
        }
      });
      return Object.values(byCounty)
        .map((c) => {
          if (c.n > 0 && (!c.lat || c.lat === 0)) {
            c.lat = c.lat / c.n;
            c.lng = c.lng / c.n;
          }
          return c;
        })
        .filter((c) => c.lat && c.lng);
    } else if (zoom < 12) {
      const byCity = {};
      filteredGeoProps.forEach((p) => {
        const city = p.city || "Altele";
        if (!byCity[city]) byCity[city] = { count: 0, lat: 0, lng: 0, n: 0, city, county: p.county, type: "city" };
        byCity[city].count++;
        byCity[city].lat += p.latitude;
        byCity[city].lng += p.longitude;
        byCity[city].n++;
      });
      return Object.values(byCity)
        .map((c) => ({ ...c, lat: c.n > 0 ? c.lat / c.n : 0, lng: c.n > 0 ? c.lng / c.n : 0 }))
        .filter((c) => c.lat && c.lng);
    }
    return filteredGeoProps.map((p) => ({
      ...p,
      lat: p.latitude,
      lng: p.longitude,
      count: 1,
      type: "property",
    }));
  }, [filteredGeoProps, zoom]);

  const visibleProperties = useMemo(() => {
    let result = filteredGeoProps;
    if (bounds) {
      result = result.filter(
        (p) =>
          p.latitude >= bounds.south &&
          p.latitude <= bounds.north &&
          p.longitude >= bounds.west &&
          p.longitude <= bounds.east
      );
    }
    if (polygonPoints.length >= 3) {
      result = result.filter((p) => pointInPolygon(p.latitude, p.longitude, polygonPoints));
    }
    if (sort === "price_asc") result = [...result].sort((a, b) => (a.price_monthly || 0) - (b.price_monthly || 0));
    else if (sort === "price_desc") result = [...result].sort((a, b) => (b.price_monthly || 0) - (a.price_monthly || 0));
    else if (sort === "newest") result = [...result].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    else result = [...result].sort(compareByBoostThenViews);
    return result;
  }, [filteredGeoProps, bounds, polygonPoints, sort]);

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [bounds, polygonPoints, cityParam, zoneParam, countyParam, typeParam, qParam, activeFilters, planFilters, budget, roomsMin, surfaceMin, furnished, swap, fairness, sort]);

  const displayedProperties = visibleProperties.slice(0, displayCount);
  const coverMap = useMemo(() => buildCoverMap(properties || []), [properties]);
  const hasMore = displayedProperties.length < visibleProperties.length;

  // 99+ format for badge
  const badgeCount = visibleProperties.length > 99 ? "99+" : String(visibleProperties.length);

  // ---- banda de carduri de pe telefon --------------------------------------
  // Conținutul ei vine din aceleași rezultate ca lista, dar se ÎNGHEAȚĂ cât
  // timp e trasă cu degetul: altfel selectarea unui card mută harta, mutarea
  // hărții schimbă rezultatele, iar cardul de sub deget dispare.
  const [railBusy, setRailBusy] = useState(false);
  const [railItems, setRailItems] = useState([]);
  const railBusyTimer = useRef(null);

  useEffect(() => {
    const next = visibleProperties.slice(0, RAIL_MAX);
    if (!railBusy) { setRailItems(next); return; }
    const id = setTimeout(() => setRailItems(next), 900);
    return () => clearTimeout(id);
  }, [visibleProperties, railBusy]);

  const holdRail = useCallback(() => {
    setRailBusy(true);
    clearTimeout(railBusyTimer.current);
    railBusyTimer.current = setTimeout(() => setRailBusy(false), 900);
  }, []);
  useEffect(() => () => clearTimeout(railBusyTimer.current), []);

  // Cardul ajuns în centrul benzii aprinde pinul lui. Harta se mută DOAR dacă
  // pinul a ieșit din cadru — panoramarea la fiecare card ar rescrie lista sub
  // deget fără motiv.
  const handleRailSelect = useCallback((id) => {
    holdRail();
    setSelectedId(id);
    setHoveredKey(id);
    const p = railItems.find((x) => String(x.id) === String(id));
    if (!p || !mapInstance) return;
    const ll = L.latLng(p.latitude, p.longitude);
    if (!mapInstance.getBounds().pad(-0.15).contains(ll)) {
      mapInstance.panTo(ll, { animate: true, duration: 0.5 });
    }
  }, [holdRail, railItems, mapInstance]);

  const handleClusterClick = useCallback(
    (cluster) => {
      if (cluster.type === "county") {
        setFlyTarget({ lat: cluster.lat, lng: cluster.lng, zoom: 9 });
      } else if (cluster.type === "city") {
        setFlyTarget({ lat: cluster.lat, lng: cluster.lng, zoom: 12 });
      } else if (cluster.type === "property") {
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        if (isMobile) {
          // Telefon: atingi pinul → banda de jos se aduce la cardul lui. Nimic
          // nu mai urcă peste hartă.
          holdRail();
          setRailOpen(true);
          setSelectedId(cluster.id);
          setHoveredKey(cluster.id);
        } else {
          navigate(`/property/${cluster.id}`);
        }
      }
    },
    [navigate, holdRail]
  );

  const saveSearch = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!bounds) return;
    try {
      const qs = `?map=${bounds.south.toFixed(4)},${bounds.west.toFixed(4)},${bounds.north.toFixed(4)},${bounds.east.toFixed(4)}`;
      await base44.entities.SavedSearch.create({
        user_id: user.id,
        label: en ? "Map search" : "Căutare pe hartă",
        query_string: qs,
      });
      toast({ title: en ? "Search saved" : "Căutare salvată", description: en ? "You'll find it in Saved Searches." : "O găsești în Căutări salvate." });
    } catch (e) {
      toast({ title: en ? "Error" : "Eroare", description: e.message, variant: "destructive" });
    }
  };

  const finishDraw = () => {
    if (polygonPoints.length < 3) {
      toast({ title: en ? "Need 3+ points" : "Necesari 3+ puncte", variant: "destructive" });
      return;
    }
    setDrawMode(false);
  };

  const cancelDraw = () => {
    setDrawMode(false);
    setPolygonPoints([]);
  };

  const clearPolygon = () => setPolygonPoints([]);

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100dvh-3.5rem)]">
      {/* MAP PANE — z-0 contains all inner z-indexes below the header/dropdown.
          Pe telefon harta ține tot ecranul dintre antet și bara de jos: e o
          hartă, nu o ilustrație pusă deasupra unei pagini care se derulează.
          Subsolul rămâne dedesubt, în firul paginii. */}
      <div className="relative z-0 h-[calc(100dvh-3.5rem-4rem-env(safe-area-inset-bottom))] md:h-full md:flex-1">
        <MapContainer
          bounds={ROMANIA_BOUNDS}
          maxZoom={18}
          maxBounds={ROMANIA_MAX_BOUNDS}
          maxBoundsViscosity={1}
          // Zoom în sferturi. Cu pasul întreg, „încape toată țara" se rotunjea
          // în jos cu până la un nivel complet — pe telefon România ieșea la
          // jumătate de ecran, cu restul cadrului gri degeaba. Butoanele de
          // zoom rămân pe pas întreg (`zoomDelta` implicit).
          zoomSnap={0.25}
          zoomControl={false}
          scrollWheelZoom
          className="h-full w-full"
          style={{ background: "hsl(var(--secondary))" }}
        >
          {/* Fundal. PLAN e gradat spre paleta hârtiei prin filtru CSS
              (.vc-tiles-plan), cu variantă inversată pentru noapte — soluția
              provizorie până intră cheia MapTiler a clientului, moment în care
              url-ul se schimbă pe stilul Dataviz recolorat, iar filtrul cade. */}
          {basemap === "plan" ? (
            <TileLayer
              key="plan"
              className="vc-tiles-plan"
              url={`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${mapKey ? `?key=${mapKey}` : ""}`}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            />
          ) : (
            <TileLayer
              key="satelit"
              className="vc-tiles-none"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri, Maxar, Earthstar Geographics'
            />
          )}

          {/* MASCA DE ȚARĂ.
              Un singur poligon: inelul exterior acoperă tot ce poate intra în
              cadru, iar conturul României e decupat din el. Leaflet umple
              căile cu `fill-rule: evenodd`, deci gaura se face fără să conteze
              sensul inelelor. Stă în overlayPane, sub markerPane — un anunț
              lipit de graniță rămâne la fel de vizibil, doar peticul de hartă
              de lângă el se stinge. `interactive: false` ca masca să nu
              înghită click-urile de desenare a parcelei. */}
          <Polygon
            positions={[MASK_RING, ROMANIA_OUTLINE]}
            interactive={false}
            /* `className` merge ca prop de sine stătător, nu în `pathOptions`:
               react-leaflet trimite pathOptions prin `setStyle`, iar acela nu
               atinge clasa — ea se citește o singură dată, la construirea căii. */
            className="vc-map-mask"
            pathOptions={{
              stroke: false,
              fill: true,
              fillColor: mapColors.mask,
              fillOpacity: 0.94,
              fillRule: "evenodd",
            }}
          />
          {/* Granița desenată peste mască: fără ea, marginea măștii pare o
              eroare de randare, nu o linie de hotar. */}
          <Polygon
            positions={ROMANIA_OUTLINE}
            interactive={false}
            className="vc-map-border"
            pathOptions={{
              color: mapColors.border,
              weight: 1.25,
              opacity: 0.55,
              fill: false,
            }}
          />

          {/* County labels at low zoom */}
          {zoom < 8 &&
            ROMANIA_COUNTIES.map((c) => (
              <Marker
                key={`label-${c.name}`}
                position={[c.lat, c.lng]}
                icon={countyLabelIcon(c.name)}
                interactive={false}
                zIndexOffset={-500}
              />
            ))}

          {/* Drawn polygon */}
          {polygonPoints.length >= 2 && (
            <Polygon
              positions={polygonPoints}
              pathOptions={{ color: drawColor, weight: 2, fillColor: drawColor, fillOpacity: 0.1, dashArray: drawMode ? "6 4" : undefined }}
            />
          )}
          {polygonPoints.map((pt, i) => (
            <CircleMarker
              key={`pt-${i}`}
              center={pt}
              radius={5}
              pathOptions={{ color: drawColor, fillColor: drawColor, fillOpacity: 1 }}
            />
          ))}

          {/* Cluster / property markers */}
          {clusters.map((c, i) => {
            const key = `${c.type}-${c.county || c.city || c.id}-${i}`;
            const isProp = c.type === "property";
            // Doar survolarea din listă/bandă schimbă iconița. Cea de pe hartă
            // merge în `pinHoverId` și nu atinge markerul — vezi comentariul de
            // la cele două stări.
            const lit = isProp && hoveredKey === c.id;
            return (
              <Marker
                key={key}
                position={[c.lat, c.lng]}
                icon={
                  isProp
                    ? propertyIcon(c, { isActive: lit, isVisited: visitedIds.has(c.id), en })
                    : clusterIcon(c.count)
                }
                zIndexOffset={lit ? 400 : 0}
                eventHandlers={{
                  click: () => handleClusterClick(c),
                  mouseover: () => setPinHoverId(isProp ? c.id : null),
                  mouseout: () => setPinHoverId(null),
                }}
              >
                {/* Balonul e o unealtă de cursor: pe ecranele fără cursor
                    Leaflet îl deschide la atingere și rămâne peste hartă, iar
                    acolo detaliile le dă oricum banda de carduri. */}
                {canHover && (
                  <Tooltip direction="top" offset={[0, -12]}>
                    {c.type === "county"
                      ? `Județul ${c.county}`
                      : c.type === "city"
                      ? c.city
                      : `${c.title}${c.boost_active || c.featured ? ` · ${en ? "Promoted" : "Promovat"}` : ""}`}
                  </Tooltip>
                )}
              </Marker>
            );
          })}

          <TooltipGuard />
          <RomaniaLock />
          <MapController
            onBoundsChange={setBounds}
            onZoomChange={setZoom}
            flyTarget={flyTarget}
            onFlyDone={() => setFlyTarget(null)}
            onReady={setMapInstance}
          />
          <DrawController drawMode={drawMode} onAddPoint={(pt) => setPolygonPoints((prev) => [...prev, pt])} />
        </MapContainer>


        {/* ================= CROMUL DE DESKTOP =================
            Pastile cu text, pe patru colțuri. Rămâne cum era — pe un ecran lat
            harta nu duce lipsă de spațiu, iar clientul nu a reclamat-o. */}

        {/* Înapoi */}
        <button
          onClick={() => navigate("/")}
          className="absolute left-3 top-4 z-[1000] hidden min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-md transition-colors hover:border-emerald md:flex"
        >
          <ArrowLeft className="h-4 w-4" /> {en ? "Back" : "Înapoi"}
        </button>

        {/* Zoom */}
        <div className="absolute left-3 top-16 z-[1000] hidden flex-col divide-y divide-border overflow-hidden rounded-full border border-border bg-background shadow-md md:flex">
          <button
            onClick={() => mapInstance?.zoomIn()}
            className="flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-secondary"
            aria-label={en ? "Zoom in" : "Apropie"}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => mapInstance?.zoomOut()}
            className="flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-secondary"
            aria-label={en ? "Zoom out" : "Depărtează"}
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>

        {/* PLAN / SATELIT — file ștampilate */}
        <div className="absolute right-3 top-4 z-[1000] hidden divide-x divide-border overflow-hidden rounded-full border border-border bg-background shadow-md md:flex">
          {[
            { id: "plan", label: "PLAN" },
            { id: "satelit", label: "SATELIT" },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => setBasemap(b.id)}
              aria-pressed={basemap === b.id}
              className={`min-h-[40px] px-4 text-xs font-bold transition-colors ${
                basemap === b.id ? "bg-emerald text-primary-foreground" : "text-foreground hover:bg-secondary"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Salvează căutarea + desenare zonă */}
        <div className="absolute right-3 top-16 z-[1000] hidden flex-col items-end gap-1.5 md:flex">
          <button
            onClick={saveSearch}
            className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-md transition-colors hover:border-emerald"
          >
            <Heart className="h-4 w-4" /> <span className="hidden sm:inline">{en ? "Save" : "Salvează"}</span>
          </button>

          {drawMode ? (
            <>
              <button
                onClick={finishDraw}
                className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-emerald px-4 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-emerald/90"
              >
                <Check className="h-4 w-4" /> {en ? "Finish" : "Finalizează"}
              </button>
              <button
                onClick={cancelDraw}
                className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-md transition-colors hover:border-emerald"
              >
                <X className="h-4 w-4" /> {en ? "Cancel" : "Anulează"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setDrawMode(true)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-md transition-colors hover:border-emerald"
            >
              <PenLine className="h-4 w-4" /> {en ? "Draw an area" : "Desenează o zonă"}
            </button>
          )}
          {polygonPoints.length >= 3 && !drawMode && (
            <button
              onClick={clearPolygon}
              className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-semibold text-destructive shadow-md transition-colors hover:border-destructive"
            >
              <Trash2 className="h-4 w-4" /> {en ? "Clear parcel" : "Șterge parcela"}
            </button>
          )}
        </div>

        {/* ================= CROMUL DE TELEFON =================
            Reclamația clientului era că harta nu se vede de butoane. Pe telefon
            nu mai există pastile cu text peste hartă: un singur rând sus (înapoi
            / căutare / filtre) și o capsulă de unelte pe dreapta, toate rotunde
            și de 44px. Rezultatele s-au mutat într-o bandă care se trage cu
            degetul, jos — modelul DayUse. */}

        {/* Rândul de sus */}
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-[1000] flex items-center gap-2 md:hidden">
          <button
            onClick={() => navigate("/")}
            aria-label={en ? "Back" : "Înapoi"}
            className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-transform active:scale-[0.95]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Câmpul de căutare deschide lista, unde stau deja autocomplete-ul
              de localitate, căutarea liberă și filtrele. O singură suprafață de
              căutare, nu două. */}
          <button
            onClick={() => setShowListMobile(true)}
            className="pointer-events-auto flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-background px-4 text-left shadow-md transition-transform active:scale-[0.99]"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold text-foreground">
              {cityParam || zoneParam || countyParam || qParam || (en ? "Where to?" : "Unde cauți?")}
            </span>
          </button>

          <div className="pointer-events-auto">
            <SearchFiltersDrawer
              compact
              t={t}
              filters={VERIF_FILTERS}
              activeFilters={activeFilters}
              onToggle={toggleFilter}
              planOptions={PLAN_FILTER_OPTIONS}
              planFilters={planFilters}
              onTogglePlan={togglePlan}
              budget={budget} setBudget={setBudget}
              roomsMin={roomsMin} setRoomsMin={setRoomsMin}
              surfaceMin={surfaceMin} setSurfaceMin={setSurfaceMin}
              fairness={fairness} setFairness={setFairness}
              fairnessOptions={makeFairness(t)}
              furnished={furnished} setFurnished={setFurnished}
              swap={swap} setSwap={setSwap}
              sort={sort} setSort={setSort}
              sortOptions={makeSort(t)}
              onReset={resetFilters}
            />
          </div>
        </div>

        {/* Capsula de unelte, dreapta */}
        <div className="absolute right-2.5 top-[3.75rem] z-[1000] flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background shadow-md md:hidden">
          <button
            onClick={() => setBasemap((b) => (b === "plan" ? "satelit" : "plan"))}
            aria-label={basemap === "plan" ? "SATELIT" : "PLAN"}
            className={`flex h-11 w-11 items-center justify-center transition-colors ${
              basemap === "satelit" ? "bg-emerald text-primary-foreground" : "text-foreground"
            }`}
          >
            <Layers className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={saveSearch}
            aria-label={en ? "Save search" : "Salvează căutarea"}
            className="flex h-11 w-11 items-center justify-center text-foreground transition-colors active:bg-secondary"
          >
            <Heart className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => setDrawMode((v) => !v)}
            aria-label={en ? "Draw an area" : "Desenează o zonă"}
            aria-pressed={drawMode}
            className={`flex h-11 w-11 items-center justify-center transition-colors ${
              drawMode ? "bg-emerald text-primary-foreground" : "text-foreground"
            }`}
          >
            <PenLine className="h-[18px] w-[18px]" />
          </button>
          {polygonPoints.length >= 3 && !drawMode && (
            <button
              onClick={clearPolygon}
              aria-label={en ? "Clear parcel" : "Șterge parcela"}
              className="flex h-11 w-11 items-center justify-center text-destructive transition-colors active:bg-secondary"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>

        {/* Instrucțiune desenare */}
        {drawMode && (
          <div className="absolute left-1/2 top-[3.9rem] z-[1000] -translate-x-1/2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground shadow-md md:top-28">
            {en ? "Tap the map to add points" : "Apasă pe hartă pentru a adăuga puncte"}
          </div>
        )}

        {/* Jos, pe telefon: fie confirmarea parcelei, fie banda de rezultate.
            Banda nu e o placă opacă peste hartă: fâșiile goale dintre butoane
            lasă degetul să ajungă la hartă (`pointer-events-none` pe containere,
            `auto` doar pe ce e de apăsat). */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] md:hidden">
          {drawMode ? (
            <div className="pointer-events-auto flex items-center justify-center gap-2 px-3 pb-3">
              <button
                onClick={cancelDraw}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-background text-sm font-semibold text-foreground shadow-lg"
              >
                <X className="h-4 w-4" /> {en ? "Cancel" : "Anulează"}
              </button>
              <button
                onClick={finishDraw}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald text-sm font-bold text-primary-foreground shadow-lg"
              >
                <Check className="h-4 w-4" /> {en ? "Finish" : "Finalizează"}
              </button>
            </div>
          ) : (
            <>
              {/* Rândul de comandă al benzii: câte anunțuri sunt în cadru, un
                  drum către lista întreagă și un buton care ascunde banda, ca
                  harta să poată fi văzută goală. */}
              <div className="flex items-center justify-between gap-2 px-3">
                <button
                  onClick={() => setShowListMobile(true)}
                  className="pointer-events-auto flex min-h-[40px] items-center gap-2 rounded-full bg-foreground px-4 text-sm font-bold text-background shadow-lg"
                >
                  <List className="h-4 w-4" /> {badgeCount} {en ? "properties" : "proprietăți"}
                </button>
                {railItems.length > 0 && (
                  <button
                    onClick={() => setRailOpen((v) => !v)}
                    aria-pressed={railOpen}
                    aria-label={
                      railOpen
                        ? en ? "Hide cards" : "Ascunde cardurile"
                        : en ? "Show cards" : "Arată cardurile"
                    }
                    className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-lg"
                  >
                    {railOpen ? <X className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  </button>
                )}
              </div>

              {railOpen && (
                <div className="pointer-events-auto">
                  <MapCardRail
                    properties={railItems}
                    coverMap={coverMap}
                    lang={lang}
                    selectedId={selectedId}
                    onSelect={handleRailSelect}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* LIST PANE */}
      <div
        className={`${
          showListMobile ? "fixed inset-0 z-[1100] block" : "hidden"
        } md:relative md:z-auto md:block md:w-[400px] md:shrink-0 md:h-full overflow-y-auto border-t md:border-t-0 md:border-l border-border bg-background`}
      >
        <div className="sticky top-0 z-10 border-b border-border bg-background p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground tnum">
                {visibleProperties.length} {en ? "properties in this frame" : "proprietăți în cadru"}
              </p>
              <p className="text-xs text-muted-foreground">
                {polygonPoints.length >= 3
                  ? en ? "Filtered by the marked parcel" : "Filtrat după parcela marcată"
                  : en ? "Move the map to update results" : "Mută harta pentru a actualiza"}
              </p>
            </div>
            <button
              onClick={() => setShowListMobile(false)}
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary md:hidden"
              aria-label={en ? "Close list" : "Închide lista"}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Filtre unificate — aceleași ca pe fostul /search, acum direct lângă hartă */}
          <div className="mt-3 space-y-2">
            <div className="rounded border border-border bg-background px-2.5 py-2 dark:bg-card">
              <LocationAutocomplete
                country={country}
                value={{ county: countyParam, city: cityParam, zone: zoneParam }}
                onSelect={updateLocation}
                placeholder={en ? "City, county or area" : "Oraș, județ sau zonă"}
                inputClassName="text-xs font-medium"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                defaultValue={qParam}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("sr_search_placeholder")}
                className="w-full rounded border border-border bg-background py-2 pl-8 pr-3 text-xs text-foreground outline-none focus:border-emerald dark:bg-card"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchFiltersDrawer
                t={t}
                filters={VERIF_FILTERS}
                activeFilters={activeFilters}
                onToggle={toggleFilter}
                planOptions={PLAN_FILTER_OPTIONS}
                planFilters={planFilters}
                onTogglePlan={togglePlan}
                budget={budget} setBudget={setBudget}
                roomsMin={roomsMin} setRoomsMin={setRoomsMin}
                surfaceMin={surfaceMin} setSurfaceMin={setSurfaceMin}
                fairness={fairness} setFairness={setFairness}
                fairnessOptions={makeFairness(t)}
                furnished={furnished} setFurnished={setFurnished}
                swap={swap} setSwap={setSwap}
                sort={sort} setSort={setSort}
                sortOptions={makeSort(t)}
                onReset={resetFilters}
              />
              <button
                type="button"
                onClick={resetFilters}
                className="flex min-h-[36px] items-center gap-1.5 rounded border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground/70 transition-colors hover:border-emerald dark:bg-card"
              >
                <RotateCcw className="h-3.5 w-3.5" /> {t("sr_reset_filters")}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-3">
          {properties === null ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-sm" />)
          ) : visibleProperties.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-9 text-center sm:py-16">
              <p className="text-sm font-semibold text-foreground">
                {en ? "No properties in this frame" : "Nicio proprietate în acest cadru"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {en ? "Pan the map or zoom out to widen the search." : "Mută harta sau depărtează pentru a lărgi căutarea."}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 tap-44 inline-flex items-center text-sm font-bold text-emerald transition-colors hover:text-foreground"
              >
                {t("sr_reset_filters")} <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <>
              {/* Sincronizare listă ↔ hartă: cardul peste care treci ridică
                  ștampila corespunzătoare, și invers. */}
              {displayedProperties.map((p) => (
                <div
                  key={p.id}
                  onMouseEnter={() => setHoveredKey(p.id)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => markVisited(p.id)}
                  className={hoveredKey === p.id || pinHoverId === p.id ? "ring-1 ring-emerald" : undefined}
                >
                  <PropertyCard property={p} coverMap={coverMap} />
                </div>
              ))}
              {hasMore && (
                <button
                  onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
                  className="flex w-full items-center justify-center gap-2 rounded border border-border py-3 text-sm font-semibold text-emerald transition-colors hover:border-emerald hover:bg-secondary"
                >
                  {en ? "Load more" : "Încarcă mai multe"} <span aria-hidden="true">→</span>
                </button>
              )}
            </>
          )}

          {/* Cifrele hărții — pe telefon, la coada listei. Stăteau sub hartă,
              unde tăiau din ea; aici sunt tot la un tap, dar numai când omul a
              cerut lista. */}
          {properties !== null && (
            <div className="space-y-3 pb-24 pt-2 md:hidden">
              <MapInfoCards properties={properties} lang={lang} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}