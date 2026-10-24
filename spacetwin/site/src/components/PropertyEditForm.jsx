import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { callFnQuiet } from "@/lib/serverCall";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
// `setTourUrl` din lib se importa cu alt nume: setterul de state de mai
// jos are exact acelasi nume si l-ar fi umbrit in tacere.
import { fetchTourStatus, setTourUrl as saveTourUrlRemote, tourReasonText } from "@/lib/tours";
import DateField from "@/components/DateField";
import { Image as UIImage } from "@/components/ui/image";
import GooglePlacesAutocomplete from "@/components/GooglePlacesAutocomplete";
import BoostDialog from "@/components/BoostDialog";
import { fetchBoostBalance } from "@/lib/boosts";
import { boostCount } from "@/lib/plans";
import { Trash2, Camera } from "lucide-react";
import { uploadPhotos } from "@/lib/imageUpload";

const MAX_PHOTOS = 20;
const onlyPhoneDigits = (v) => {
  const clean = String(v || "").replace(/[^0-9+]/g, "");
  if (clean.startsWith("+")) return "+" + clean.slice(1).replace(/\+/g, "");
  return clean.replace(/\+/g, "");
};
const onlyDigits = (v, max) => String(v || "").replace(/[^0-9]/g, "").slice(0, max ?? 4);

// Complete edit form for an existing property — admin or the owner who posted.
// Verification/badge flags (owner_verified, ai_tour_verified, verification_level)
// are exposed only when isAdmin is true; anyone editing can change all content
// (title, price, contacts, video URL, flags like pet/parking/featured, etc.).
const TYPES = ["Garsonieră", "2 Camere", "3 Camere", "4+ Camere", "Casă", "Studio", "Teren", "Spațiu Comercial"];
const STATUS = ["Activ", "Rezervat", "Închis"];
const TRANSACTIONS = ["RENT", "SALE"];
const CURRENCIES = ["EUR", "RON", "GBP"];
const FAIRNESS = [{ v: "", label: "—" }, { v: "sub_piata", label: "Sub piață" }, { v: "corect", label: "Corect" }, { v: "peste_medie", label: "Peste medie" }];
const VERIF = [{ v: "unverified", label: "Neverificat" }, { v: "video_ai", label: "Video / AI" }, { v: "field_certified", label: "Certificat pe teren" }];

// 44px minimum touch height, rounded-xl, 16px text so iOS doesn't zoom the page.
const inputCls =
  "w-full min-h-[44px] rounded-xl border border-border bg-background px-3.5 py-2.5 text-base text-foreground outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/15 dark:bg-card";
const lab = "text-xs font-semibold text-muted-foreground";
const sectionCls = "mb-2 mt-5 font-heading text-sm font-bold text-navy dark:text-foreground";
const checkCls =
  "tap-44 flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground transition hover:border-emerald/50";
const boxCls = "h-4 w-4 shrink-0 rounded border-border accent-emerald";

// Hoisted so it keeps a stable component identity between renders — declaring it
// inside PropertyEditForm remounted every field on each keystroke and dropped focus.
function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={lab}>{label}</span>
      {children}
    </label>
  );
}

export default function PropertyEditForm({ property, onDone, isAdmin = false }) {
  const { toast } = useToast();
  const { user } = useAuth();
  // Promovarea din formularul de editare (cererea clientului, 23.08) —
  // folosește soldul celui care editează acum (proprietar SAU admin), la fel
  // cum ApplyBoost permite deja ambelor roluri să promoveze acest anunț.
  const [boostBalance, setBoostBalance] = useState(0);
  const [boostOpen, setBoostOpen] = useState(false);
  const [liveProperty, setLiveProperty] = useState(property);

  useEffect(() => {
    if (!user?.id) return;
    fetchBoostBalance(user.id).then(setBoostBalance);
  }, [user?.id]);
  // Starea turului 3D: pe ce plan e omul, câte tururi i-au mai rămas și dacă a
  // trecut de cele două ferestre de 3 zile. Se citește o dată, la deschidere.
  const [tour, setTour] = useState(null);
  const [tourUrl, setTourUrl] = useState(property.tour_3d_url || "");
  const [savingTour, setSavingTour] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTourStatus({
      userId: property.created_by_id,
      excludePropertyId: property.id,
      isAdmin,
    }).then((t) => { if (!cancelled) setTour(t); });
    return () => { cancelled = true; };
  }, [property.created_by_id, property.id, isAdmin]);

  const saveTour = async () => {
    setSavingTour(true);
    try {
      const res = await saveTourUrlRemote(property.id, tourUrl.trim());
      if (res.error) {
        toast({ title: "Turul 3D nu a fost salvat", description: res.error, variant: "destructive" });
      } else {
        toast({ title: tourUrl.trim() ? "Tur 3D salvat" : "Tur 3D șters" });
        setTour((t) => (t ? { ...t, remaining: res.remaining ?? t.remaining } : t));
      }
    } finally {
      setSavingTour(false);
    }
  };

  const [form, setForm] = useState({
    title: property.title || "",
    description: property.description || "",
    price_monthly: property.price_monthly ?? "",
    currency: property.currency || "EUR",
    transaction_type: property.transaction_type || "RENT",
    city: property.city || "",
    zone: property.zone || "",
    landmark: property.landmark || "",
    property_type: property.property_type || "Garsonieră",
    rooms: property.rooms ?? 1,
    surface_sqm: property.surface_sqm ?? "",
    floor: property.floor || "",
    total_floors: property.total_floors ?? "",
    building_year: property.building_year ?? "",
    deposit: property.deposit ?? "",
    available_from: property.available_from || "",
    furnished: !!property.furnished,
    pet_friendly: !!property.pet_friendly,
    parking: !!property.parking,
    phone: property.phone || "",
    whatsapp_phone: property.whatsapp_phone || "",
    owner_name: property.owner_name || "",
    seller_role: property.seller_role || "Proprietar",
    ai_video_url: property.ai_video_url || "",
    tour_3d_url: property.tour_3d_url || "",
    monthly_utilities_estimate: property.monthly_utilities_estimate ?? "",
    maintenance_fee: property.maintenance_fee ?? "",
    deposit_option: property.deposit_option || "standard",
    price_fairness: property.price_fairness || "",
    status: property.status || "Activ",
    featured: !!property.featured,
    commission_free: !!property.commission_free,
    reserve_instant: !!property.reserve_instant,
    is_swap_available: !!property.is_swap_available,
    owner_verified: !!property.owner_verified,
    ai_tour_verified: !!property.ai_tour_verified,
    verification_level: property.verification_level || "unverified",
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    images: Array.isArray(property.images) ? [...property.images] : [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const numOrNull = (v) => (v === "" || v == null ? null : Number(v));

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (form.images.length >= MAX_PHOTOS) {
      toast({ title: `Ai atins maximul de ${MAX_PHOTOS} poze`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const remaining = Math.max(0, MAX_PHOTOS - form.images.length);
      const urls = await uploadPhotos(files, remaining);
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
      if (urls.length) toast({ title: `${urls.length} poze adăugate` });
    } catch (err) {
      toast({ title: "Eroare la încărcare", variant: "destructive" });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const removeImage = (idx) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price_monthly || !form.city) {
      toast({ title: "Completează titlu, preț și oraș", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        transaction_type: form.transaction_type,
        currency: form.currency,
        price_monthly: Number(form.price_monthly),
        city: form.city,
        zone: form.zone,
        landmark: form.landmark,
        property_type: form.property_type,
        rooms: form.rooms ? Number(form.rooms) : null,
        surface_sqm: numOrNull(form.surface_sqm),
        floor: form.floor,
        total_floors: numOrNull(form.total_floors),
        building_year: numOrNull(form.building_year),
        deposit: numOrNull(form.deposit),
        available_from: form.available_from || null,
        furnished: form.furnished,
        pet_friendly: form.pet_friendly,
        parking: form.parking,
        phone: form.phone,
        whatsapp_phone: form.whatsapp_phone,
        owner_name: form.owner_name,
        seller_role: form.seller_role,
        ai_video_url: form.ai_video_url,
        monthly_utilities_estimate: numOrNull(form.monthly_utilities_estimate),
        maintenance_fee: numOrNull(form.maintenance_fee),
        deposit_option: "standard",
        price_fairness: form.price_fairness || null,
        status: form.status,
        featured: form.featured,
        commission_free: form.commission_free,
        reserve_instant: form.reserve_instant,
        is_swap_available: form.is_swap_available,
        latitude: form.latitude,
        longitude: form.longitude,
        images: form.images,
      };
      if (isAdmin) {
        payload.owner_verified = form.owner_verified;
        payload.ai_tour_verified = form.ai_tour_verified;
        payload.verification_level = form.verification_level;
        payload.tour_3d_url = form.tour_3d_url;
      }
      await base44.entities.Property.update(property.id, payload);
      callFnQuiet("ComputeTrustScore", { property_id: property.id });
      toast({ title: "Anunț actualizat" });
      onDone();
    } catch (err) {
      toast({ title: "Eroare la salvare", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-emerald/25 bg-emerald-soft/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-heading text-lg font-bold text-navy dark:text-foreground">Editează anunțul</h3>
        {isAdmin && <span className="shrink-0 rounded-full bg-navy px-3 py-1 text-[11px] font-semibold text-white">Mod admin</span>}
      </div>

      {/* Date de bază */}
      <p className={`${sectionCls} mt-0`}>Date de bază</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titlu"><input value={form.title} onChange={(e) => upd("title", e.target.value)} className={inputCls} /></Field>
        <Field label="Tip tranzacție">
          <select value={form.transaction_type} onChange={(e) => upd("transaction_type", e.target.value)} className={`${inputCls} vc-select pr-10`}>
            {TRANSACTIONS.map((x) => <option key={x} value={x}>{x === "RENT" ? "Închiriere" : "Vânzare"}</option>)}
          </select>
        </Field>
        <Field label="Preț">
          <div className="flex gap-2">
            <input type="number" value={form.price_monthly} onChange={(e) => upd("price_monthly", e.target.value)} className={inputCls} />
            <select value={form.currency} onChange={(e) => upd("currency", e.target.value)} className={`${inputCls} vc-select w-28 pr-10`}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </Field>
        <Field label="Tip proprietate">
          <select value={form.property_type} onChange={(e) => upd("property_type", e.target.value)} className={`${inputCls} vc-select pr-10`}>
            {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </Field>
      </div>
      <textarea value={form.description} onChange={(e) => upd("description", e.target.value)} placeholder="Descriere" rows={3} className={`mt-3 ${inputCls}`} />

      {/* Poze */}
      <p className={sectionCls}>Poze ({form.images.length}/{MAX_PHOTOS})</p>
      <p className="mb-2 -mt-1 text-xs text-muted-foreground">Poze reale, făcute cu telefonul. Fără randări.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {form.images.map((img, i) => (
          <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-secondary">
            <UIImage src={img} fittingType="fill" className="h-full w-full" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              aria-label="Șterge poza"
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-navy-deep/75 text-white transition hover:bg-rose-600 sm:h-9 sm:w-9"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {form.images.length < MAX_PHOTOS && (
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-card/60 text-xs font-medium text-muted-foreground transition hover:border-emerald hover:text-emerald">
            {uploading ? <span className="animate-pulse">Se încarcă…</span> : (<><Camera className="h-5 w-5" /> Adaugă</>)}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
          </label>
        )}
      </div>

      {/* Locație */}
      <p className={sectionCls}>Locație</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Oraș și zonă">
          <div className={inputCls}>
            <LocationAutocomplete
              country="RO"
              value={{ city: form.city, zone: form.zone }}
              onSelect={({ city, zone }) => setForm((f) => ({ ...f, city, zone }))}
              placeholder="Scrie orașul"
              includeCounties={false}
            />
          </div>
        </Field>
        <Field label="Caută pe Google Maps">
          <GooglePlacesAutocomplete
            value={form.landmark}
            onChange={(v) => upd("landmark", v)}
            onPlace={(place) => setForm((f) => ({ ...f, landmark: place.name || f.landmark, latitude: place.lat ?? f.latitude, longitude: place.lng ?? f.longitude }))}
            placeholder="ex: Strada Nicolae Iorga"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Specificații */}
      <p className={sectionCls}>Specificații</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Camere"><input type="number" value={form.rooms} onChange={(e) => upd("rooms", e.target.value)} className={inputCls} /></Field>
        <Field label="Suprafață (mp)"><input type="number" value={form.surface_sqm} onChange={(e) => upd("surface_sqm", e.target.value)} className={inputCls} /></Field>
        <Field label="Etaj"><input value={form.floor} onChange={(e) => upd("floor", e.target.value)} placeholder="ex: 2/4" className={inputCls} /></Field>
        <Field label="Total etaje"><input inputMode="numeric" value={form.total_floors ?? ""} onChange={(e) => upd("total_floors", onlyDigits(e.target.value, 3))} className={inputCls} /></Field>
        <Field label="An construcție"><input inputMode="numeric" value={form.building_year ?? ""} onChange={(e) => upd("building_year", onlyDigits(e.target.value, 4))} className={inputCls} /></Field>
        <Field label="Depozit"><input type="number" value={form.deposit} onChange={(e) => upd("deposit", e.target.value)} className={inputCls} /></Field>
        <Field label="Disponibil din">
          <DateField value={form.available_from} onChange={(e) => upd("available_from", e.target.value)} placeholder="Selectează o dată" className="w-full" />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => upd("status", e.target.value)} className={`${inputCls} vc-select pr-10`}>
            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className={checkCls}><input type="checkbox" className={boxCls} checked={form.furnished} onChange={(e) => upd("furnished", e.target.checked)} /> Mobilat</label>
        <label className={checkCls}><input type="checkbox" className={boxCls} checked={form.pet_friendly} onChange={(e) => upd("pet_friendly", e.target.checked)} /> Pet friendly</label>
        <label className={checkCls}><input type="checkbox" className={boxCls} checked={form.parking} onChange={(e) => upd("parking", e.target.checked)} /> Parcare</label>
        <label className={checkCls}><input type="checkbox" className={boxCls} checked={form.featured} onChange={(e) => upd("featured", e.target.checked)} /> Featured</label>
        <label className={checkCls}><input type="checkbox" className={boxCls} checked={form.commission_free} onChange={(e) => upd("commission_free", e.target.checked)} /> Fără comision</label>
        <label className={checkCls}><input type="checkbox" className={boxCls} checked={form.reserve_instant} onChange={(e) => upd("reserve_instant", e.target.checked)} /> Rezervare instantă</label>
        <label className={checkCls}><input type="checkbox" className={boxCls} checked={form.is_swap_available} onChange={(e) => upd("is_swap_available", e.target.checked)} /> Schimb de chirie</label>
      </div>

      {/* Contact */}
      <p className={sectionCls}>Contact & proprietar</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Telefon"><input inputMode="numeric" value={form.phone} onChange={(e) => upd("phone", onlyPhoneDigits(e.target.value))} placeholder="07xx..." className={inputCls} /></Field>
        <Field label="WhatsApp (internațional)"><input inputMode="tel" value={form.whatsapp_phone} onChange={(e) => upd("whatsapp_phone", onlyPhoneDigits(e.target.value))} placeholder="407xx..." className={inputCls} /></Field>
        <Field label="Nume proprietar"><input value={form.owner_name} onChange={(e) => upd("owner_name", e.target.value)} className={inputCls} /></Field>
        <Field label="Rol vânzător">
          <select value={form.seller_role} onChange={(e) => upd("seller_role", e.target.value)} className={`${inputCls} vc-select pr-10`}>
            <option value="Proprietar">Proprietar</option>
            <option value="Agent">Agent</option>
          </select>
        </Field>
      </div>

      {/* Costuri & tur AI */}
      <p className={sectionCls}>Costuri & Tur 3D</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Estimare utilități/lună"><input type="number" value={form.monthly_utilities_estimate} onChange={(e) => upd("monthly_utilities_estimate", e.target.value)} className={inputCls} /></Field>
        <Field label="Întreținere/lună"><input type="number" value={form.maintenance_fee} onChange={(e) => upd("maintenance_fee", e.target.value)} className={inputCls} /></Field>
        <Field label="Corectitudine preț">
          <select value={form.price_fairness} onChange={(e) => upd("price_fairness", e.target.value)} className={`${inputCls} vc-select pr-10`}>
            {FAIRNESS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </select>
        </Field>
      </div>

      {/* Tur 3D — self-serve pentru proprietar, deblocat cu Basic, Pro sau
          Agent. Regulile (3 zile de la plată, apoi un tur la 3 zile, plus cota
          din plan) sunt impuse în SetTourUrl; aici doar se arată motivul
          înainte să apese cineva. */}
      <div className="mt-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/images/generated/icon-video.png"
              alt=""
              aria-hidden="true"
              className={`h-12 w-12 shrink-0 object-contain ${tour?.allowed || form.tour_3d_url ? "" : "opacity-60"}`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-navy dark:text-foreground">Tur 3D</span>
              <span className="block text-xs text-muted-foreground">
                {tour
                  ? tourReasonText(tour, false) || `Ți-au mai rămas ${tour.remaining} din ${tour.quota}`
                  : "Se verifică…"}
              </span>
            </span>
          </div>
          {tour && !isAdmin && (
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {tour.remaining} / {tour.quota}
            </span>
          )}
        </div>

        {(tour?.allowed || form.tour_3d_url) && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Link tur 3D</span>
              <input
                value={tourUrl}
                onChange={(e) => setTourUrl(e.target.value)}
                placeholder="https://tur3d.verificasa.ro/property/..."
                className={inputCls}
              />
            </label>
            <button
              type="button"
              onClick={saveTour}
              disabled={savingTour}
              className="h-11 shrink-0 rounded-full bg-emerald px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingTour ? "Se salvează…" : "Salvează turul"}
            </button>
          </div>
        )}

        {/* Promovare — același BoostDialog folosit în "Anunțurile mele", doar
            mutat și aici ca să nu fie nevoie să ieși din formular. Sold-ul afișat
            e al celui care editează acum (owner sau admin). */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-navy dark:text-foreground">Promovează anunțul</span>
            <span className="block text-xs text-muted-foreground">
              {boostCount(liveProperty) > 0
                ? `ai ${boostCount(liveProperty)} ${boostCount(liveProperty) === 1 ? "promovare" : "promovări"}`
                : "nepromovat încă"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setBoostOpen(true)}
            className="h-11 shrink-0 rounded-full bg-emerald px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Promovează
          </button>
        </div>

        <BoostDialog
          open={boostOpen}
          onOpenChange={setBoostOpen}
          property={liveProperty}
          balance={boostBalance}
          onDone={(res) => {
            setBoostBalance(res.balance ?? boostBalance);
            setLiveProperty((p) => ({ ...p, boost_active: true, boost_count: res.boost_count ?? (boostCount(p) + 1) }));
          }}
        />
      </div>

      {/* Badge-uri & verificări — admin only */}
      {isAdmin && (
        <>
          <p className={sectionCls}>Badge-uri & verificări (admin)</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nivel verificare">
              <select value={form.verification_level} onChange={(e) => upd("verification_level", e.target.value)} className={`${inputCls} vc-select pr-10`}>
                {VERIF.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}
              </select>
            </Field>
            <label className={`${checkCls} self-end`}><input type="checkbox" className={boxCls} checked={form.owner_verified} onChange={(e) => upd("owner_verified", e.target.checked)} /> Proprietar verificat</label>
            {/* Linkul turului stă DOAR în blocul „Tur 3D" de mai sus (cererea
                clientului, 23.08) — al doilea câmp de aici doar îl dubla.
                Valorile existente se salvează în continuare nevăzute. */}
            <label className={`${checkCls} self-end`}><input type="checkbox" className={boxCls} checked={form.ai_tour_verified} onChange={(e) => upd("ai_tour_verified", e.target.checked)} /> Activare badge Tur 3D</label>
          </div>
        </>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Button type="submit" disabled={saving} className="h-12 rounded-full bg-emerald px-6 text-white hover:bg-emerald/90">
          {saving ? "Salvez..." : "Salvează"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} className="h-12 rounded-full px-5">Renunță</Button>
      </div>
    </form>
  );
}