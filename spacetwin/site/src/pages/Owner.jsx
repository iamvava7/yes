import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCountry } from "@/components/CountryContext";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Image as UIImage } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Plus, Download } from "lucide-react";
import OwnerCharts from "@/components/OwnerCharts";
import PropertyWizard from "@/components/postproperty/PropertyWizard";
import BoostDialog from "@/components/BoostDialog";
import { PropertyBadge } from "@/components/PropertyBadges";
import { fetchBoostBalance } from "@/lib/boosts";
import { isBoosted } from "@/lib/plans";

// Sanitizează intrările telefon la doar cifre (opțional "+" la început pentru internațional).
const onlyPhoneDigits = (v) => {
  const clean = String(v || "").replace(/[^0-9+]/g, "");
  if (clean.startsWith("+")) return "+" + clean.slice(1).replace(/\+/g, "");
  return clean.replace(/\+/g, "");
};
const only_digits = (v, max) => String(v || "").replace(/[^0-9]/g, "").slice(0, max ?? 4);

const MAX_PHOTOS = 20;
const MIN_PHOTOS = 3;

export default function Owner() {
  const { country, t, lang } = useCountry();
  const { user } = useAuth();
  const { toast } = useToast();
  const [properties, setProperties] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  // Promovarea sta si aici, nu doar in /my-properties. Proprietarul aterizeaza
  // pe pagina asta din subsol si din meniu; daca butonul exista doar pe cealalta
  // lista de anunturi, concluzia lui e ca functia nu exista.
  const [balance, setBalance] = useState(0);
  const [boostTarget, setBoostTarget] = useState(null);
  const formRef = useRef(null);

  // Auto-open the form when the user came from a "Adaugă Anunț" link with ?nou=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nou") === "1") setShowForm(true);
  }, []);

  // Smooth-scroll to the form whenever it becomes visible.
  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showForm]);

  const load = async () => {
    if (!user?.id) return;
    try {
      const [ps, inq, bal] = await Promise.all([
        base44.entities.Property.filter({ created_by_id: user.id }, "-created_date", 50),
        base44.entities.Inquiry.list("-created_date", 50),
        fetchBoostBalance(user.id),
      ]);
      setProperties(ps);
      setInquiries(inq);
      setBalance(bal);
    } catch (e) {
      setProperties([]);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  // La fel ca în MyProperties.jsx: soldul de boost-uri e o entitate separată
  // (BoostCredit), nu intră automat în niciun alt subscribe. Fără asta,
  // promovarea din alt tab/pagină rămâne "în urmă" aici până la refresh manual.
  useEffect(() => {
    if (!user?.id) return undefined;
    const unsub = base44.entities.BoostCredit.subscribe(() => {
      fetchBoostBalance(user.id).then(setBalance);
    });
    return () => { try { unsub && unsub(); } catch { /* noop */ } };
  }, [user?.id]);

  const en = lang === "en";
  const totalViews = (properties || []).reduce((a, p) => a + (p.views_count || 0), 0);

  const STAT_CARDS = [
    { img: "/images/generated/icon-document-check.png", label: t("s_active"), value: properties?.length ?? "—" },
    { img: "/images/generated/icon-gauge.png", label: en ? "Total listing views" : "Vizionări totale", value: totalViews },
    { img: "/images/generated/icon-chat.png", label: t("s_inq"), value: inquiries.length },
  ];

  return (
    <div className="bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold sm:text-3xl text-navy dark:text-foreground">{t("owner_h")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("owner_sub")}</p>
          </div>
          <Button
            onClick={() => setShowForm((s) => !s)}
            className="h-11 rounded-full bg-emerald px-5 text-primary-foreground shadow-soft hover:bg-emerald/90"
          >
            <Plus className="h-4 w-4" /> {t("owner_add")}
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
          {STAT_CARDS.map((s, i) => (
            <div key={i} className="surface-card rounded-2xl p-3 sm:p-4">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-soft sm:h-12 sm:w-12">
                  <img src={s.img} alt="" aria-hidden="true" className="h-6 w-6 object-contain sm:h-7 sm:w-7" />
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-lg font-bold leading-none text-navy dark:text-foreground sm:text-2xl">{s.value}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-muted-foreground sm:text-xs">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <OwnerCharts ownerId={user?.id} lang={lang} />

        {showForm && (
          <div ref={formRef}>
            <NewPropertyForm onDone={() => { setShowForm(false); load(); }} />
          </div>
        )}

        {/* PROPERTIES */}
        <div className="mt-5 sm:mt-8">
          <h2 className="font-heading text-xl font-bold text-navy dark:text-foreground">{t("my_props")}</h2>
          {properties === null ? (
            <div className="mt-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          ) : properties.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border py-9 text-center sm:py-16">
              <img
                src="/images/generated/icon-camera-verify.png"
                alt=""
                aria-hidden="true"
                className="mx-auto h-12 w-12 object-contain opacity-70"
              />
              <p className="mt-3 text-sm text-muted-foreground">{t("no_props")}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {properties.map((p) => {
                const boosted = isBoosted(p);
                const approved = p.approval_status === "APPROVED";
                return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft sm:gap-4 sm:p-4">
                  <Link to={`/property/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary">
                      {p.images?.[0] ? <UIImage src={p.images[0]} fittingType="fill" className="h-full w-full" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold text-navy line-clamp-1 dark:text-foreground">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.zone}, {p.city} · {p.property_type}</p>
                    </div>
                  </Link>
                  <div className="flex w-full flex-wrap items-center gap-2 text-xs sm:w-auto sm:gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground"><Eye className="h-3.5 w-3.5" /> {p.views_count || 0}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${p.approval_status === "APPROVED" ? "bg-emerald-soft text-emerald" : "bg-gold-soft text-gold-deep"}`}>
                      {p.approval_status === "APPROVED" ? (en ? "Approved" : "Aprobat") : (en ? "Pending" : "În așteptare")}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${p.status === "Activ" ? "bg-emerald-soft text-emerald" : "bg-secondary text-muted-foreground"}`}>{p.status}</span>
                    {boosted && <PropertyBadge kind="promovat" size="sm" lang={lang} />}
                  </div>
                  <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                    <Button
                      onClick={() => setBoostTarget(p)}
                      disabled={!approved}
                      title={!approved ? (en ? "Approve the listing first" : "Anunțul trebuie aprobat întâi") : undefined}
                      className="h-11 flex-1 rounded-full bg-emerald px-4 text-xs text-primary-foreground hover:bg-emerald/90 disabled:opacity-50 sm:flex-none"
                    >
                      {boosted ? (en ? "Promote more" : "Promovează mai mult") : (en ? "Promote" : "Promovează")}
                    </Button>
                    <Button variant="outline" className="h-11 flex-1 gap-1.5 rounded-full px-4 text-xs sm:flex-none">
                      <Download className="h-3.5 w-3.5" /> {t("contract_pdf")}
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* INQUIRIES */}
        {inquiries.length > 0 && (
          <div className="mt-5 sm:mt-8">
            <h2 className="font-heading text-xl font-bold text-navy dark:text-foreground">{t("inq_title")}</h2>
            <div className="mt-4 space-y-3">
              {inquiries.map((inq) => (
                <div key={inq.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-navy dark:text-foreground">{inq.name} <span className="text-xs font-normal text-muted-foreground">— {inq.property_title}</span></p>
                      <p className="truncate text-xs text-muted-foreground">{inq.email} · {inq.phone || t("inq_no_phone")}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${inq.status === "Nou" ? "bg-emerald text-primary-foreground" : inq.status === "Calificat" ? "bg-emerald-soft text-emerald" : inq.status === "Vizionare programată" ? "bg-gold-soft text-gold-deep" : "bg-secondary text-muted-foreground"}`}>{inq.status}</span>
                  </div>
                  {(inq.occupation || inq.estimated_income) && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {inq.occupation && <span>{t("inq_occupation")} {inq.occupation}</span>}
                      {inq.estimated_income && <span>{t("inq_income")} {inq.estimated_income}</span>}
                      {inq.move_date && <span>{t("inq_move")} {new Date(inq.move_date).toLocaleDateString(en ? "en-GB" : "ro-RO")}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BoostDialog
        open={!!boostTarget}
        onOpenChange={(v) => !v && setBoostTarget(null)}
        property={boostTarget}
        balance={balance}
        onDone={(res) => { setBalance(res.balance ?? balance - 1); load(); }}
      />
    </div>
  );
}

// Kept as a named export for existing imports — the listing flow is now the
// step-by-step wizard.
export function NewPropertyForm({ onDone, onCancel }) {
  return (
    <div className="mt-6">
      <PropertyWizard onDone={onDone} onCancel={onCancel} />
    </div>
  );
}