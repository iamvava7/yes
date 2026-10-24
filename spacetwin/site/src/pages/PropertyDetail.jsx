import { boostCount } from "@/lib/plans";
import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNowStrict, isValid } from "date-fns";
import { ro, enGB } from "date-fns/locale";

import { useCountry } from "@/components/CountryContext";
import PropertyEditForm from "@/components/PropertyEditForm";
import PropertyComments from "@/components/PropertyComments";
import SimilarProperties from "@/components/SimilarProperties";
import Lightbox from "@/components/Lightbox";
import ReportModal from "@/components/ReportModal";
import ContactPanel from "@/components/ContactPanel";
import PropertyPresentation from "@/components/PropertyPresentation";
import PropertyDescription from "@/components/PropertyDescription";
import PropertyGoogleMap from "@/components/PropertyGoogleMap";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  MapPin, ChevronLeft, ChevronRight,
  Heart, Pencil, MessageCircle, Maximize2, X,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { startConversation } from "@/lib/conversations";
import { createNotification } from "@/lib/notifications";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { ScoreLedger } from "@/components/fisa";
import { PropertyBadgeRow } from "@/components/PropertyBadges";
import { galleryOf } from "@/lib/covers";

export default function PropertyDetail() {
  const { id } = useParams();
  const { country, formatPrice, t, legalInfo, lang } = useCountry();
  const locale = lang === "en" ? "en-GB" : "ro-RO";
  const { toast } = useToast();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState("gallery");
  const [ownerUser, setOwnerUser] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tour3dFull, setTour3dFull] = useState(false);
  const [showLb, setShowLb] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const viewedRef = useRef(new Set());
  const touchStartX = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    if (!user || !property) return;
    (async () => {
      try {
        const list = await base44.entities.SavedProperty.filter({ user_id: user.id, property_id: property.id }, "-created_date", 1);
        if (!cancelled) setSaved(list.length > 0);
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [user, property]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await base44.entities.Property.get(id);
        if (cancelled) return;
        const shouldInc = !viewedRef.current.has(id);
        if (shouldInc) viewedRef.current.add(id);
        setProperty(shouldInc ? { ...p, views_count: (p.views_count || 0) + 1 } : p);
        setTab(p.ai_tour_verified ? "ai" : "gallery");
        if (p.created_by_id) {
          base44.entities.User.get(p.created_by_id).then((u) => { if (!cancelled) setOwnerUser(u); }).catch(() => {});
        }
        if (shouldInc) {
          base44.functions.invoke("IncrementViews", { property_id: id }).catch(() => {});
        }
      } catch (e) {
        if (!cancelled) setProperty(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="mt-4 h-[220px] rounded-2xl sm:h-[420px]" />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl sm:h-96 lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl sm:h-96" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary sm:h-16 sm:w-16">
          <MapPin className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="mt-4 font-heading text-2xl font-bold text-navy dark:text-foreground">{t("not_found")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "en"
            ? "This listing may have been removed or is no longer available."
            : "Acest anunț ar fi putut fi șters sau nu mai este disponibil."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button asChild variant="outline" className="min-h-[44px] rounded-full px-5"><Link to="/search">{t("back_results")}</Link></Button>
          <Button asChild className="min-h-[44px] rounded-full bg-emerald px-5 text-white hover:bg-emerald/90"><Link to="/">{t("back_home")}</Link></Button>
        </div>
      </div>
    );
  }

  const p = property;
  // Galeria trece prin galleryOf: anunțurile demo cu randări desenate primesc
  // fotografiile locale, ca pagina să arate a portal, nu a catalog generat.
  const images = galleryOf(p);
  const isSale = p.transaction_type === "SALE";
  const isAdmin = user && ["SUPER_ADMIN", "ADMIN"].includes((user.role || "").toUpperCase());
  const canEdit = !!user && (isAdmin || (user.id && p.created_by_id === user.id));

  const toggleSave = async () => {
    if (!user) { navigate("/login"); return; }
    try {
      if (saved) {
        const list = await base44.entities.SavedProperty.filter({ user_id: user.id, property_id: p.id }, "-created_date", 10);
        for (const s of list) await base44.entities.SavedProperty.delete(s.id);
        setSaved(false); toast({ title: t("pd_unsaved") });
      } else {
        await base44.entities.SavedProperty.create({ user_id: user.id, property_id: p.id });
        setSaved(true); toast({ title: t("pd_saved_toast") });
        // „Like la postare": notify owner someone liked/saved their listing
        if (p.created_by_id && p.created_by_id !== user.id) {
          createNotification({
            userId: p.created_by_id,
            type: "like",
            text: t("pd_like_msg", { name: user.full_name || user.email, title: p.title }),
            link: `/property/${p.id}`,
            actorName: user.full_name || user.email,
          });
        }
      }
    } catch (e) { toast({ title: t("pc_err_msg"), variant: "destructive" }); }
  };

  const handleMessage = async () => {
    if (!user) { navigate("/login"); return; }
    try {
      const conv = await startConversation(user, p);
      navigate(`/messages/${conv.id}?prefill=1`);
    } catch (e) { toast({ title: t("pc_err_msg"), variant: "destructive" }); }
  };

  const stats = [
    { label: t("stat_rooms"), value: p.rooms },
    { label: t("stat_area"), value: `${p.surface_sqm} mp` },
    // Garanția are sens doar la închiriere; la vânzare ar repeta prețul.
    isSale
      ? (p.building_year != null
        ? { label: lang === "en" ? "Built" : "An construcție", value: p.building_year }
        : null)
      : { label: t("stat_deposit"), value: formatPrice(p.deposit || p.price_monthly, p.currency) },
    { label: t("stat_avail"), value: p.available_from && isValid(new Date(p.available_from)) ? new Date(p.available_from).toLocaleDateString(locale) : t("immediate") },
  ].filter(Boolean);

  // Faptele măsurate la fața locului — produsul propriu-zis al VerifiCasa.
  const measured = [
    p.surface_sqm != null && { label: lang === "en" ? "Surface" : "Suprafață", value: p.surface_sqm, sub: "mp" },
    p.internet_speed_mbps && { label: t("pd_fac_internet"), value: p.internet_speed_mbps, sub: "Mbps" },
    p.noise_db != null && { label: t("pd_fac_noise"), value: p.noise_db, sub: "dB" },
    p.light_orientation && { label: t("pd_fac_orientation"), value: p.light_orientation },
    p.water_pressure_ok && { label: t("pd_fac_water"), value: lang === "en" ? "compliant" : "conformă" },
    p.metro_distance_min != null && { label: lang === "en" ? "Transit" : "Transport", value: p.metro_distance_min, sub: "min" },
    p.maintenance_fee != null && { label: lang === "en" ? "Maintenance" : "Întreținere", value: formatPrice(p.maintenance_fee, p.currency) },
    p.monthly_utilities_estimate != null && { label: lang === "en" ? "Utilities est." : "Estimare utilități", value: formatPrice(p.monthly_utilities_estimate, p.currency) },
    p.building_year != null && { label: lang === "en" ? "Built" : "An construcție", value: p.building_year },
  ].filter(Boolean);

  // Dotările, ca pastile simple — nu ștampile.
  const amenities = [
    p.ai_tour_verified && t("badge_aitour_v"),
    p.tour_3d_url && t("tab_3d"),
    p.pet_friendly && t("badge_pet_v"),
    p.parking && t("badge_parking"),
    p.furnished && t("badge_furnished"),
  ].filter(Boolean);

  // Tab-urile galeriei (Galerie/Prezentare/Tur 3D) — pastile rotunde, verde
  // pentru cel activ, așezate într-un rând normal deasupra fotografiei.
  const tabPill = (active) =>
    `tap-44 inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
      active ? "bg-emerald text-white" : "border border-border bg-card text-muted-foreground hover:text-foreground"
    }`;

  const tabSwitcherButtons = (
    <>
      {/* Galeria e tab-ul implicit: rămâne marcat activ și pentru valorile
          vechi de tab („ai") care oricum cad tot pe galerie. */}
      <button type="button" onClick={() => setTab("gallery")} className={tabPill(tab !== "3d" && tab !== "presentation")}>
        {t("tab_gallery")} ({images.length})
      </button>
      {images.length > 0 && (
        <button type="button" onClick={() => setTab("presentation")} className={tabPill(tab === "presentation")}>
          {lang === "en" ? "Showcase" : "Prezentare"}
        </button>
      )}
      {p.tour_3d_url && (
        <button type="button" onClick={() => setTab("3d")} className={tabPill(tab === "3d")}>
          {t("tab_3d")}
        </button>
      )}
    </>
  );

  return (
    <div className="bg-background">
      {tour3dFull && p.tour_3d_url && (
        <div className="fixed inset-0 z-[100] bg-navy-deep">
          <iframe
            src={p.tour_3d_url}
            title={lang === "en" ? "3D tour" : "Tur 3D"}
            className="h-full w-full"
            allowFullScreen
            allow="xr-spatial-tracking; fullscreen; autoplay"
            frameBorder="0"
          />
          <button
            type="button"
            onClick={() => setTour3dFull(false)}
            aria-label={lang === "en" ? "Close" : "Închide"}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-800 shadow-lg transition-transform hover:scale-105"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4 lg:px-8">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* LEFT */}
          <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-2">
            {/* GALLERY */}
            <div className="relative">
          {/* Comenzile galeriei stau într-un rând normal deasupra fotografiei:
              nicio bară translucidă peste imagine, nimic scris pe poză. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/search")}
              aria-label={t("back_results")}
              className="tap-44 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-emerald hover:text-emerald"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {tabSwitcherButtons}
          </div>

          {tab === "3d" ? (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-navy-deep">
              <iframe
                src={p.tour_3d_url}
                title={lang === "en" ? "3D tour" : "Tur 3D"}
                className="aspect-video w-full"
                allowFullScreen
                allow="xr-spatial-tracking; fullscreen; autoplay"
                frameBorder="0"
              />
              <button
                type="button"
                onClick={() => setTour3dFull(true)}
                className="absolute bottom-3 right-3 flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-neutral-800 shadow-md lg:hidden"
              >
                <Maximize2 className="h-4 w-4" /> {lang === "en" ? "Fullscreen" : "Ecran complet"}
              </button>
            </div>
          ) : tab === "presentation" ? (
            <PropertyPresentation images={images} title={p.title} />
          ) : (
            <div className="select-none">
              <div
                className="relative flex select-none items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-secondary shadow-[0_18px_50px_-24px_rgba(16,24,40,0.35)]"
                style={{ aspectRatio: "16 / 10" }}
                onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  if (touchStartX.current == null) return;
                  const dx = e.changedTouches[0].clientX - touchStartX.current;
                  if (Math.abs(dx) > 50 && images.length > 1) {
                    setActiveImage((i) => (i + (dx < 0 ? 1 : -1) + images.length) % images.length);
                  }
                  touchStartX.current = null;
                }}
              >
                <AnimatePresence>
                  {images[activeImage] && (
                    <motion.button
                      key={activeImage}
                      type="button"
                      onClick={() => { setLbIndex(activeImage); setShowLb(true); }}
                      className="absolute inset-0 h-full w-full cursor-zoom-in overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Image src={images[activeImage]} alt={p.title} fittingType="fill" className="h-full w-full object-cover" />
                    </motion.button>
                  )}
                </AnimatePresence>
                {!images[activeImage] && (
                  <div className="flex aspect-video w-full max-w-3xl items-center justify-center bg-secondary text-muted-foreground">
                    <span className="text-sm">{t("info_missing")}</span>
                  </div>
                )}

                {/* Preîncărcăm pozele vecine (stânga/dreapta) la aceeași dimensiune ca poza
                    principală, ca navigarea next/prev să pară instantă în loc să
                    reîncarce vizibil de fiecare dată. */}
                {images.length > 1 && (
                  <div className="pointer-events-none absolute inset-0 opacity-0" aria-hidden="true">
                    <Image src={images[(activeImage + 1) % images.length]} fittingType="fill" className="h-full w-full object-cover" />
                    <Image src={images[(activeImage - 1 + images.length) % images.length]} fittingType="fill" className="h-full w-full object-cover" />
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImage((i) => (i - 1 + images.length) % images.length)}
                      aria-label={lang === "en" ? "Previous photo" : "Fotografia anterioară"}
                      className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-800 shadow-md transition-transform hover:scale-105 sm:h-12 sm:w-12"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                      aria-label={lang === "en" ? "Next photo" : "Fotografia următoare"}
                      className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-800 shadow-md transition-transform hover:scale-105 sm:h-12 sm:w-12"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                      {activeImage + 1} / {images.length}
                    </span>
                  </>
                )}

                {/* Salvează — acces rapid direct pe poza principală, ca la Zillow */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleSave(); }}
                  aria-label={saved ? t("pd_saved") : t("pd_save")}
                  className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-800 shadow-md transition-transform hover:scale-105"
                >
                  <Heart className={`h-5 w-5 transition ${saved ? "fill-rose-500 text-rose-500" : "text-neutral-700"}`} />
                </button>
              </div>

              {/* Insignele SUB galerie, nu peste fotografia principală: pe fișa
                  unui anunț fotografia e argumentul, iar două pastile în colțul
                  ei acopereau exact ce venise omul să vadă. */}
              <PropertyBadgeRow
                property={p}
                size="md"
                lang={lang}
                className="mt-3 max-w-full"
              />

              {images.length > 1 && (
                <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`${lang === "en" ? "Photo" : "Fotografia"} ${i + 1}`}
                      className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-secondary transition-all sm:h-20 sm:w-28 ${activeImage === i ? "border-emerald" : "border-transparent opacity-70 hover:opacity-100"}`}
                    >
                      <Image src={img} alt="" fittingType="fill" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* KEY STATS — carduri moi, nu un registru cu linii */}
        <RevealGroup className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {stats.map((s, i) => (
            <RevealItem key={i} y={10} className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="truncate text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-0.5 truncate font-heading text-lg font-semibold leading-tight text-foreground tnum">{s.value}</p>
            </RevealItem>
          ))}
        </RevealGroup>

            {editing && (
              <PropertyEditForm
                property={p}
                isAdmin={isAdmin}
                onDone={async () => {
                  setEditing(false);
                  try { const np = await base44.entities.Property.get(id); setProperty(np); } catch {}
                }}
              />
            )}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              {/* Prețul primul, ca la Zillow — pe telefon e prima informație
                  căutată, iar titlul curge sub el pe toată lățimea. */}
              <p className="font-heading text-[2rem] font-semibold leading-none text-foreground tnum sm:text-4xl">
                {formatPrice(p.price_monthly, p.currency)}
                {!isSale && (
                  <span className="ml-1 font-body text-sm font-medium text-muted-foreground">{t("pc_permonth")}</span>
                )}
              </p>
              <h1 className="mt-2 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{p.title}</h1>
              <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{p.zone}, {p.city}{p.landmark ? ` · ${p.landmark}` : ""}, {p.country === "UK" ? t("pd_country_uk") : t("pd_country_ro")}</span>
              </p>

              {/* Dotările, ca pastile rotunde. Insignele (Promovat / Agent /
                  Verificat) stau pe fotografie, nu se repetă aici. */}
              {amenities.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {amenities.map((a) => (
                    <span key={a} className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground/80">
                      {a}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={handleMessage} className="tap-44 h-9 gap-1.5 rounded-full bg-emerald px-5 text-primary-foreground hover:bg-emerald/90">
                  <MessageCircle className="h-4 w-4" /> {t("pd_msg_btn")}
                </Button>
                <Button variant="outline" size="sm" onClick={toggleSave} className="tap-44 h-9 gap-1.5 rounded-full border-border px-4 text-foreground hover:border-emerald hover:text-emerald">
                  <Heart className={`h-4 w-4 ${saved ? "fill-rose-500 text-rose-500" : ""}`} /> {saved ? t("pd_saved") : t("pd_save")}
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="tap-44 h-9 gap-1.5 rounded-full border-border px-4 text-foreground hover:border-emerald hover:text-emerald">
                    <Pencil className="h-4 w-4" /> {t("pd_edit")}
                  </Button>
                )}
                <ReportModal targetType="property" targetId={p.id} targetTitle={p.title} variant="outline" size="sm" className="tap-44 h-9 rounded-full border-border px-4" />
              </div>

              {/* Cine a postat și când — o singură linie liniștită */}
              {p.created_date && (
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {p.created_by_id ? (
                    <Link to={`/profile/${p.created_by_id}`} className="font-medium text-foreground/70 underline-offset-2 hover:text-emerald hover:underline">
                      {p.posted_by_name || p.owner_name || "VerifiCasa"}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground/70">{p.posted_by_name || p.owner_name || "VerifiCasa"}</span>
                  )}
                  <span className="text-foreground/40">·</span>
                  {isValid(new Date(p.created_date))
                    ? formatDistanceToNowStrict(new Date(p.created_date), { addSuffix: true, locale: lang === "en" ? enGB : ro })
                    : "—"}
                </p>
              )}

              {p.approved_by_name && (
                <p className="mt-1 text-xs text-emerald">
                  <span aria-hidden="true">✓</span> {t("pd_approved_by").replace(/[:·]\s*$/, "")} {p.approved_by_name}
                  {p.approved_date && isValid(new Date(p.approved_date))
                    ? ` · ${new Date(p.approved_date).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })}`
                    : ""}
                </p>
              )}

              <p className="mt-1 text-[11px] text-muted-foreground/60">
                {t("pd_code_label")} <span className="select-all">{p.property_code || p.id}</span>
              </p>

              {/* Câte promovări poartă anunțul. Boost-urile se adună și nu expiră,
                  deci numărul e o informație, nu un cronometru — stă exact
                  înaintea datelor despre locuință, cum a cerut clientul. Linia
                  apare pe fiecare anunț, inclusiv la zero — altfel „lipsește". */}
              {boostCount(p) > 0 ? (
                <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
                  {lang === "en"
                    ? `Promoted · ${boostCount(p)} ${boostCount(p) === 1 ? "boost" : "boosts"} on this listing`
                    : `Promovat · ${boostCount(p)} boost${boostCount(p) === 1 ? "" : "-uri"} pe acest anunț`}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  {lang === "en" ? "Boosts used: 0" : "Boost-uri folosite: 0"}
                </p>
              )}

              {/* MĂSURĂTORI — carduri moi, nu un registru cu linii */}
              {(p.internet_speed_mbps || p.noise_db != null || p.light_orientation || p.water_pressure_ok || p.maintenance_fee || p.monthly_utilities_estimate) && measured.length > 0 && (
                <div className="mt-5">
                  <h2 className="font-heading text-lg font-semibold text-foreground">
                    {lang === "en" ? "Measured on site" : "Măsurat la fața locului"}
                  </h2>
                  <RevealGroup className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {measured.map((m) => (
                      <RevealItem key={m.label} y={10} className="rounded-xl bg-secondary px-3 py-2.5">
                        <p className="truncate text-xs text-muted-foreground">{m.label}</p>
                        <p className="mt-0.5 truncate font-heading text-base font-semibold text-foreground tnum">
                          {m.value}
                          {m.sub && <span className="ml-1 font-body text-xs font-normal text-muted-foreground">{m.sub}</span>}
                        </p>
                      </RevealItem>
                    ))}
                  </RevealGroup>
                </div>
              )}

              <p className="mt-5 text-xs text-muted-foreground">
                {legalInfo.tenantFee}
              </p>

              <h2 className="mt-6 font-heading text-lg font-semibold text-foreground">{t("desc_h")}</h2>
              <PropertyDescription
                text={p.description}
                emptyLabel={t("info_missing")}
                moreLabel={lang === "en" ? "Read more" : "Află mai mult"}
                lessLabel={lang === "en" ? "Show less" : "Arată mai puțin"}
              />
            </div>

            {/* MAP */}
            <Reveal>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="font-heading font-bold text-navy dark:text-foreground">{t("map_h")}</h3>
                    <p className="truncate text-xs text-muted-foreground">{t("map_sub")}</p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full bg-emerald-soft px-3 py-1 text-[11px] font-semibold text-emerald">
                    {p.latitude && p.longitude ? t("map_exact") : t("map_approx")}
                  </span>
                </div>
                <MapPreview
                  lat={p.latitude}
                  lng={p.longitude}
                  title={p.title}
                  landmark={p.landmark}
                  zone={p.zone}
                  city={p.city}
                  t={t}
                />
              </div>
            </Reveal>

            {/* SCORUL, CU CALCULUL LA VEDERE — inclusiv scăderile.
                Niciun marketplace nu arată de ce un anunț a punctat prost.
                Acesta o face; asta e ce transformă un contor de completare
                într-o verificare. */}
            <Reveal>
              <ScoreLedger
                className="overflow-hidden rounded-2xl"
                score={p.trust_score}
                breakdown={p.trust_breakdown ? (() => { try { return JSON.parse(p.trust_breakdown); } catch { return null; } })() : null}
                labels={{
                  title: lang === "en" ? "Listing score" : "Scor anunț",
                  sub: lang === "en"
                    ? "How completely this listing is filled in. Outside verification is the last 20 points."
                    : "Cât de complet e completat anunțul. Verificarea din afară e ultimele 20 de puncte.",
                  high: lang === "en" ? "Complete" : "Anunț complet",
                  mid: lang === "en" ? "Partly filled in" : "Parțial completat",
                  low: lang === "en" ? "Incomplete" : "Incomplet",
                  missing: lang === "en" ? "What would raise it" : "Ce ar ridica scorul",
                  pending: lang === "en"
                    ? "The breakdown is published at the listing's next recalculation."
                    : "Detalierea se publică la următoarea recalculare a anunțului.",
                }}
              />
            </Reveal>

            {/* COMMENTS */}
            <PropertyComments property={p} />

            {/* SIMILAR RECOMMENDATIONS */}
            <SimilarProperties property={p} />
          </div>
          {showLb && images.length > 0 && (
            <Lightbox
              images={images}
              index={lbIndex}
              onIndex={setLbIndex}
              onClose={() => setShowLb(false)}
              saved={saved}
              onToggleSave={toggleSave}
              title={p.title}
            />
          )}

          {/* RIGHT — Contact panel */}
          <div className="min-w-0 lg:col-span-1">
            <div className="sticky top-20">
              <Reveal>
                <ContactPanel property={p} ownerUser={ownerUser} onMessage={handleMessage} />
              </Reveal>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function MapPreview({ lat, lng, title, landmark, zone, city, t }) {
  return (
    <PropertyGoogleMap
      lat={lat}
      lng={lng}
      title={title}
      landmark={landmark}
      zone={zone}
      city={city}
      t={t}
    />
  );
}