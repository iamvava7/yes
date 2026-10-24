import { getCounty } from "@/components/locations";
import {
  Wifi, VolumeX, Sun, Droplet, Snowflake, Sunset, ArrowUpDown, Flame, Layers,
  Armchair, ChefHat, Tv, Shirt, Trees, Car, PawPrint, Tag,
} from "lucide-react";

export const MAX_PHOTOS = 20;
export const MIN_PHOTOS = 3;
// Clientul, 23.08: pasul de dotări nu se trece cu mâna goală — minim 3 bife,
// oricare, din oricare grup (verificate + dotări + opțiuni la un loc).
export const MIN_FEATURES = 3;

// Eticheta etajului pe carduri. Datele au valori amestecate — „Parter", „0",
// „2", „2/4" — iar un număr gol pe card („· 8") nu spune nimic. 0 și parter
// devin „Parter", numerele devin „Etaj N", formatele libere rămân cum sunt.
export const floorLabel = (f, en = false) => {
  const s = String(f ?? "").trim();
  if (!s) return null;
  if (/^(parter|p|0)$/i.test(s)) return en ? "Ground floor" : "Parter";
  if (/^\d+(\s*\/\s*\d+)?$/.test(s)) return (en ? "Floor " : "Etaj ") + s.replace(/\s+/g, "");
  return s;
};

export const onlyPhoneDigits = (v) => {
  const clean = String(v || "").replace(/[^0-9+]/g, "");
  if (clean.startsWith("+")) return "+" + clean.slice(1).replace(/\+/g, "");
  return clean.replace(/\+/g, "");
};
export const onlyDigits = (v, max) => String(v || "").replace(/[^0-9]/g, "").slice(0, max ?? 4);

export const EMPTY_FORM = {
  title: "", description: "", price_monthly: "", city: "", zone: "", landmark: "", property_type: "Garsonieră",
  rooms: "1", surface_sqm: "", floor: "", deposit: "", available_from: "", images: "",
  latitude: "", longitude: "", owner_name: "",
  transaction_type: "RENT", building_year: "", total_floors: "", phone: "", whatsapp_phone: "",
  seller_role: "Proprietar",
  parking: false, pet_friendly: false, commission_free: false,
};

// `label` e ȘI text de interfață, ȘI valoarea salvată în `features` (vezi mai
// jos, în buildPropertyPayload). Deci nu se traduce în loc: `label_en` e strict
// pentru afișare, iar în bază intră mereu varianta românească. Altfel aceeași
// dotare ar exista în două grafii și filtrele de căutare s-ar rupe.
export const CHIP_OPTS = [
  { key: "wifi", icon: Wifi, label: "Internet / Wi-Fi", label_en: "Internet / Wi-Fi", feature: "Internet / Wi-Fi" },
  { key: "noise", icon: VolumeX, label: "Zonă liniștită", label_en: "Quiet area", feature: "Zonă liniștită" },
  { key: "light", icon: Sun, label: "Orientare / Luminozitate", label_en: "Aspect / Daylight", feature: "Orientare Sud" },
  { key: "water", icon: Droplet, label: "Presiune apă verificată", label_en: "Water pressure checked", feature: "Presiune apă OK" },
];

export const FACILITY_OPTS = [
  { key: "ac", icon: Snowflake, label: "Aer Condiționat", label_en: "Air conditioning" },
  { key: "balcon", icon: Sunset, label: "Balcon", label_en: "Balcony" },
  { key: "lift", icon: ArrowUpDown, label: "Lift", label_en: "Lift" },
  { key: "centrala", icon: Flame, label: "Centrală proprie", label_en: "Own boiler" },
  { key: "termopan", icon: Layers, label: "Geamuri Termopan", label_en: "Double glazing" },
  { key: "mobilat", icon: Armchair, label: "Mobilat complet", label_en: "Fully furnished" },
  { key: "bucatarie", icon: ChefHat, label: "Bucătărie utilată", label_en: "Fitted kitchen" },
  { key: "tv", icon: Tv, label: "Smart TV", label_en: "Smart TV" },
  { key: "masina_spalat", icon: Shirt, label: "Mașină de spălat", label_en: "Washing machine" },
  { key: "terasa", icon: Trees, label: "Terasă / Grădină", label_en: "Terrace / Garden" },
];

export const OPTION_OPTS = [
  { key: "parking", icon: Car, label: "Parcare", label_en: "Parking" },
  { key: "pet_friendly", icon: PawPrint, label: "Pet Friendly", label_en: "Pet friendly" },
  { key: "commission_free", icon: Tag, label: "Fără Comision", label_en: "No commission" },
];

/** Eticheta de AFIȘARE a unei opțiuni. Valoarea salvată rămâne `label`. */
export function optLabel(opt, en) {
  return (en && opt.label_en) || opt.label;
}

// Builds the Property entity payload from wizard/form state.
export function buildPropertyPayload({ form, chips, facilities, country, user, isAdmin, property_code }) {
  return {
    property_code,
    title: form.title,
    description: form.description,
    price_monthly: Number(form.price_monthly),
    currency: "EUR",
    country,
    county: getCounty(form.city),
    city: form.city,
    zone: form.zone,
    landmark: form.landmark || "",
    property_type: form.property_type,
    rooms: Number(form.rooms),
    surface_sqm: Number(form.surface_sqm) || null,
    floor: form.floor || "",
    deposit: Number(form.deposit) || null,
    transaction_type: form.transaction_type || "RENT",
    building_year: form.building_year ? Number(form.building_year) : null,
    total_floors: form.total_floors ? Number(form.total_floors) : null,
    phone: form.phone || "",
    whatsapp_phone: form.whatsapp_phone || "",
    seller_role: form.seller_role || "Proprietar",
    approval_status: isAdmin ? "APPROVED" : "PENDING",
    ...(isAdmin ? {
      approved_by_id: user.id,
      approved_by_name: user.full_name || user.email,
      approved_date: new Date().toISOString(),
    } : {}),
    furnished: true,
    pet_friendly: form.pet_friendly,
    parking: form.parking,
    commission_free: form.commission_free,
    deposit_option: "standard",
    available_from: form.available_from || null,
    images: form.images ? form.images.split(",").filter(Boolean) : [],
    ai_video_url: "",
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
    owner_name: form.owner_name || "Proprietar",
    posted_by_name: user?.full_name || form.owner_name || "VerifiCasa",
    owner_verified: false,
    ai_tour_verified: false,
    status: "Activ",
    featured: false,
    views_count: 0,
    internet_speed_mbps: chips.wifi ? 100 : null,
    noise_db: chips.noise ? 35 : null,
    light_orientation: chips.light ? "Sud" : "",
    water_pressure_ok: !!chips.water,
    features: [
      ...CHIP_OPTS.filter((c) => chips[c.key]).map((c) => c.feature),
      ...FACILITY_OPTS.filter((f) => facilities[f.key]).map((f) => f.label),
    ],
  };
}