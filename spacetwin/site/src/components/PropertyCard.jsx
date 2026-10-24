import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Phone, MessageCircle, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { useCountry } from "@/components/CountryContext";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { startConversation } from "@/lib/conversations";
import { Image } from "@/components/ui/image";
import { base44 } from "@/api/base44Client";
import { PropertyBadgeRow } from "@/components/PropertyBadges";
import { coverOf } from "@/lib/covers";
import { floorLabel } from "@/lib/propertyPayload";

// Cardul de anunț. Fotografia conduce, prețul e primul lucru citit, iar sub el
// stă o singură linie de caracteristici. Codul anunțului, contorul de
// vizualizări și scorul numeric au ieșit de pe card: sunt informație de pagină
// de anunț, nu de listă. Insignele stau pe fotografie, ca la orice portal.
export default function PropertyCard({ property, hot = false, coverMap }) {
  const { currency, formatPrice, t, lang } = useCountry();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const p = property;
  const en = lang === "en";

  // Galeria pornește de la coperta calculată, ca prima imagine să fie cea care
  // apare și în restul listei.
  const cover = coverOf(p, coverMap);
  const images = p.images?.length
    ? (cover && !p.images.includes(cover) ? [cover, ...p.images.slice(1)] : p.images)
    : (cover ? [cover] : []);

  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(null);

  const boosted = p.boost_active || p.featured || hot;
  const seller = p.seller_role || (p.owner_verified ? "Proprietar" : "Agent");
  const isProprietar = seller === "Proprietar";
  const sellerLabel = isProprietar ? t("pc_seller_landlord") : t("pc_seller_agent");

  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!user || !p?.id) { setSaved(false); return undefined; }
    (async () => {
      try {
        const list = await base44.entities.SavedProperty.filter({ user_id: user.id, property_id: p.id }, "-created_date", 1);
        if (!cancelled) setSaved(list.length > 0);
      } catch (e) { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [user, p?.id]);

  const toggleSave = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!isAuthenticated) { navigate("/login"); return; }
    if (savePending) return;
    setSavePending(true);
    try {
      if (saved) {
        const list = await base44.entities.SavedProperty.filter({ user_id: user.id, property_id: p.id }, "-created_date", 10);
        for (const s of list) await base44.entities.SavedProperty.delete(s.id);
        setSaved(false);
        toast({ title: t("pd_unsaved") });
      } else {
        await base44.entities.SavedProperty.create({ user_id: user.id, property_id: p.id });
        setSaved(true);
        toast({ title: t("pd_saved_toast") });
      }
    } catch (err) {
      toast({ title: t("pc_err_msg"), variant: "destructive" });
    } finally {
      setSavePending(false);
    }
  };

  const eur = formatPrice(p.price_monthly, p.currency, "EUR");
  const ron = formatPrice(p.price_monthly, p.currency, "RON");
  const primary = currency === "EUR" ? eur : ron;

  const toDetail = () => navigate(`/property/${p.id}`);

  const handleMessage = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!isAuthenticated) { navigate("/login"); return; }
    try {
      const conv = await startConversation(user, p);
      navigate(`/messages/${conv.id}?prefill=1`);
    } catch (err) {
      toast({ title: t("pc_err_msg"), variant: "destructive" });
    }
  };

  const callPhone = (p.phone || "").replace(/\D/g, "");
  const hasPhone = !!callPhone && callPhone.length >= 6;

  // O singură linie de specificații, în ordinea în care oamenii chiar caută.
  const specs = [
    p.rooms != null && `${p.rooms} ${en ? (p.rooms === 1 ? "room" : "rooms") : "cam."}`,
    p.surface_sqm != null && `${p.surface_sqm} mp`,
    floorLabel(p.floor, en),
  ].filter(Boolean).join(" · ");

  const place = p.zone || p.city ? `${p.zone ? p.zone + ", " : ""}${p.city || ""}` : t("info_missing");

  const step = (dir) => (e) => {
    e.preventDefault(); e.stopPropagation();
    if (images.length < 2) return;
    setIdx((i) => (i + dir + images.length) % images.length);
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.985] active:shadow-md">
      <div
        className="relative aspect-[16/10] cursor-pointer overflow-hidden touch-pan-y sm:aspect-[4/3]"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const sx = touchStartX.current;
          if (sx == null) return;
          const dx = e.changedTouches[0].clientX - sx;
          if (Math.abs(dx) > 40 && images.length > 1) {
            setIdx((i) => (i + (dx < 0 ? 1 : -1) + images.length) % images.length);
          }
          touchStartX.current = null;
        }}
        onClick={toDetail}
      >
        {images.length ? (
          <Image
            src={images[idx]}
            alt={p.title}
            fittingType="fill"
            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <span className="text-xs text-muted-foreground">{t("info_missing")}</span>
          </div>
        )}

        <button
          type="button"
          onClick={toggleSave}
          aria-label={saved ? t("pd_unsaved") : t("pd_saved_toast")}
          disabled={savePending}
          className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-neutral-700 shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-out hover:scale-105 active:scale-90 disabled:opacity-60 dark:bg-neutral-900/90 dark:text-neutral-200"
        >
          <Heart className={`h-[18px] w-[18px] ${saved ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={step(-1)}
              aria-label={en ? "Previous photo" : "Fotografia anterioară"}
              className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-800 opacity-0 shadow transition-opacity group-hover:opacity-100 sm:flex"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={step(1)}
              aria-label={en ? "Next photo" : "Fotografia următoare"}
              className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-800 opacity-0 shadow transition-opacity group-hover:opacity-100 sm:flex"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.slice(0, 6).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div onClick={toDetail} className="flex min-w-0 flex-1 cursor-pointer flex-col p-3 sm:p-4">
        {/* Insignele stau SUB fotografie, nu peste ea.
            Fotografia e argumentul de vânzare al anunțului; două pastile în
            colțul ei acopereau exact partea pe care o priveşte omul. Aici spun
            acelaşi lucru, în banda de text unde stau oricum faptele. */}
        <PropertyBadgeRow
          property={{ ...p, boost_active: boosted }}
          size="sm"
          lang={lang}
          className="mb-2 max-w-full"
        />

        <p className="text-[1.15rem] font-bold leading-none text-foreground tnum sm:text-2xl">
          {primary}
          <span className="ml-1 text-sm font-semibold text-muted-foreground">
            {p.transaction_type === "SALE" ? "" : t("pc_permonth")}
          </span>
        </p>

        {/* Telefon: faptele si locul pe un singur rand. Desktop: doua randuri
            plus titlul, unde exista latime pentru ele. */}
        <p className="mt-1 truncate text-[13px] text-muted-foreground sm:hidden">
          {specs && <span className="font-semibold text-foreground/80">{specs}</span>}
          {specs && place ? " · " : ""}
          {place}
        </p>

        <div className="hidden sm:block">
          {specs && <p className="mt-1.5 truncate text-sm font-semibold text-foreground/80">{specs}</p>}

          <p className="mt-1 truncate text-sm text-muted-foreground">{place}</p>

          <h3 className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">
            {p.title || ""}
          </h3>
        </div>
      </div>

      {/* Rândul cu cine a postat + butoanele de sunat/mesaj NU apar pe telefon.
          Adăugau 61px fiecărui card și puneau două butoane rotunde pe fiecare
          anunț dintr-o listă — douăsprezece pe un ecran. Identitatea și ambele
          contacte sunt la o atingere distanță, în pagina anunțului. */}
      <div className="hidden items-center gap-2.5 border-t border-border px-3.5 py-2.5 sm:flex sm:px-4">
        <Link
          to={p.created_by_id ? `/profile/${p.created_by_id}` : "#"}
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 items-center"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
            {(p.posted_by_name || p.owner_name || "V").charAt(0).toUpperCase()}
          </span>
        </Link>
        <Link
          to={p.created_by_id ? `/profile/${p.created_by_id}` : "#"}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1"
        >
          <p className="truncate text-xs font-semibold text-foreground hover:text-emerald">
            {p.posted_by_name || p.owner_name || "VerifiCasa"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{sellerLabel}</p>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {hasPhone && (
            <a
              href={`tel:${callPhone}`}
              onClick={(e) => e.stopPropagation()}
              title={t("pc_call")}
              aria-label={t("pc_call")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-[transform,border-color,color] duration-200 ease-out hover:border-emerald hover:text-emerald active:scale-90 active:border-emerald active:text-emerald"
            >
              <Phone className="h-[18px] w-[18px]" />
            </a>
          )}
          <button
            onClick={handleMessage}
            title={t("pc_message")}
            aria-label={t("pc_message")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald text-primary-foreground transition-transform duration-200 ease-out hover:scale-105 active:scale-90"
          >
            <MessageCircle className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </article>
  );
}
