import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, Send, ArrowLeft, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useCountry } from "@/components/CountryContext";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { inputCls, Field, ChoiceCard } from "@/components/postproperty/wizardUi";

// Roles and packages keep their Romanian `value` — that string is what gets
// written to InspectionRequest, so only the label is translated.
const ROLES = [
  { value: "Proprietar",          iconSrc: "/images/generated/icon-proprietari.png",  labelKey: "ins_role_owner" },
  { value: "Chiriaș/Cumpărător",  iconSrc: "/images/generated/icon-chiriasi.png",     labelKey: "ins_role_tenant" },
  { value: "Agent",               iconSrc: "/images/generated/icon-agenti.png",       labelKey: "ins_role_agent" },
];

const PACKAGES = [
  { value: "Verificare Standard", en: "Standard check",  icon: "/images/generated/icon-shield-check.png" },
  { value: "Verificare Acte",     en: "Paperwork check", icon: "/images/generated/icon-document-check.png" },
  { value: "Verificare Completă", en: "Full check",      icon: "/images/generated/icon-camera-verify.png" },
  { value: "Plan Pro",            en: "Pro plan",        icon: "/images/generated/plan-icon-pro-v2.png" },
];

export default function InspectieModal({ open, onClose }) {
  const { t, lang } = useCountry();
  // Local RO/EN pairs for the strings this wizard owns; i18n.js is not ours to
  // extend, and makeT() falls back to Romanian for unknown keys.
  const L = (ro, en) => (lang === "en" ? en : ro);
  const STEPS = [
    L("Rol & Contact", "Role & contact"),
    L("Proprietate", "Property"),
    L("Mesaj", "Message"),
  ];
  const { toast } = useToast();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "Proprietar", address_or_url: "", package_interest: "", message: "" });
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset/lifecycle: rulează STRICT la deschidere/închidere, nu la orice
  // schimbare de referință a obiectului `user` din context (altfel un refresh
  // silențios al auth-ului în timp ce modalul e deschis reseta wizard-ul înapoi
  // la pasul 1 și părea că "se închide").
  useEffect(() => {
    if (!open) return;
    setStep(0);
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onEsc); document.body.style.overflow = ""; };
  }, [open]);

  // Preia automat numele și emailul din contul utilizatorului autentificat —
  // separat de efectul de mai sus, ca să nu resetețe pasul curent.
  useEffect(() => {
    if (!open || !isAuthenticated || !user) return;
    setForm((f) => ({ ...f, name: user.full_name || f.name, email: user.email || f.email }));
  }, [open, isAuthenticated, user?.full_name, user?.email]);

  if (!open) return null;

  const needsAuth = !isLoadingAuth && !isAuthenticated;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const clearError = (field) => setErrors((er) => (er[field] ? { ...er, [field]: undefined } : er));

  // Returnează un obiect { field: mesaj } cu TOATE câmpurile lipsă de la pasul
  // `s` — folosit atât pentru a bloca avansarea cât și pentru a evidenția
  // vizual (border roșu + mesaj) exact câmpurile necompletate, nu doar un toast.
  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.name.trim()) e.name = L("Completează numele tău.", "Please enter your name.");
      if (!form.email.trim()) e.email = L("Completează emailul.", "Please enter your email.");
    }
    if (s === 1 && !form.address_or_url.trim()) e.address_or_url = L("Adaugă adresa sau link-ul anunțului.", "Add the listing address or link.");
    return e;
  };

  const next = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast({ title: Object.values(errs)[0], variant: "destructive" });
      return;
    }
    setErrors({});
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => {
    if (step === 0) { onClose(); return; }
    setStep((s) => s - 1);
  };

  const submit = async (e) => {
    e.preventDefault();
    for (let s = 0; s <= 1; s++) {
      const errs = validateStep(s);
      if (Object.keys(errs).length) { setStep(s); setErrors(errs); toast({ title: Object.values(errs)[0], variant: "destructive" }); return; }
    }
    setSending(true);
    try {
      await base44.entities.InspectionRequest.create({ ...form, status: "Nou" });
      try {
        base44.functions.invoke("NotifyOnInspectionRequest", { request: { ...form } }).catch(() => {});
      } catch (_) {}
      toast({ title: t("ins_sent_t"), description: t("ins_sent_d") });
      setForm({ name: "", email: "", phone: "", role: "Proprietar", address_or_url: "", package_interest: "", message: "" });
      onClose();
    } catch (err) {
      toast({ title: t("ins_err"), variant: "destructive" });
    } finally { setSending(false); }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-navy-deep/70" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl dark:bg-card">
        {/* Header — poză de fundal generată cu Higgsfield + scrim de lizibilitate */}
        <div className="relative shrink-0 overflow-hidden">
          <img src="/images/generated/inspectie-header-v1.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/92 via-navy-deep/55 to-navy-deep/15" />
          <button onClick={onClose} aria-label={t("ins_close")} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/35">
            <X className="h-5 w-5" />
          </button>
          <div className="relative flex min-h-[104px] flex-col justify-end p-5 text-white sm:min-h-[136px] sm:p-6">
            <h3 className="font-heading text-xl font-bold">{t("ins_title")}</h3>
            <p className="text-sm text-white/80">{t("ins_sub")}</p>
          </div>
        </div>

        {needsAuth ? (
          <div className="flex flex-col items-center justify-center gap-4 px-5 py-7 text-center sm:px-6 sm:py-12">
            <img src="/images/generated/icon-lock.png" alt="" className="h-14 w-14 object-contain" />
            <div>
              <h3 className="font-heading text-lg font-bold text-navy dark:text-foreground">
                {L("Autentificare necesară", "Sign in required")}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {L("Intră în cont ca să ceri o verificare — preluăm datele de contact automat.",
                   "Sign in to request a check — we pull your contact details automatically.")}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button asChild className="min-h-[48px] rounded-full bg-emerald px-6 text-white shadow-soft hover:bg-emerald/90">
                <Link to="/login">{L("Intră în cont", "Sign in")}</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-[48px] rounded-full px-6">
                <Link to="/register">{L("Creează cont", "Create account")}</Link>
              </Button>
            </div>
            <button onClick={onClose} className="mt-1 tap-44 text-xs text-muted-foreground hover:underline">
              {L("Anulează", "Cancel")}
            </button>
          </div>
        ) : (
        <>
        {/* Stepper header */}
        <div className="shrink-0 border-b border-border/60 px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">{STEPS[step]}</h2>
            <p className="shrink-0 text-xs font-semibold text-emerald tnum">
              {L(`Pasul ${step + 1} din ${STEPS.length}`, `Step ${step + 1} of ${STEPS.length}`)}
            </p>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-emerald transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Step body */}
        <form
          onSubmit={submit}
          onKeyDown={(e) => {
            // Enter într-un câmp de tip input NU trebuie să trimită formularul
            // înainte de pasul final — altfel cererea pleacă fără mesaj și modalul
            // se închide direct din pasul 1 sau 2, sărind peste pasul "Mesaj".
            if (e.key === "Enter" && step < STEPS.length - 1) {
              e.preventDefault();
              next();
            }
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5">
            {/* Step 0 — Rol & Contact */}
            {step === 0 && (
              <div className="space-y-4">
                <Field label={L("Rolul tău", "Your role")} required>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {ROLES.map((r) => (
                      <ChoiceCard
                        key={r.value}
                        active={form.role === r.value}
                        onClick={() => set({ role: r.value })}
                        iconSrc={r.iconSrc}
                        title={t(r.labelKey)}
                      />
                    ))}
                  </div>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={L("Nume", "Name")} required>
                    <input value={form.name} readOnly={isAuthenticated} onChange={(e) => { set({ name: e.target.value }); clearError("name"); }} placeholder={t("ins_ph_name")} className={inputCls + (isAuthenticated ? " cursor-not-allowed bg-secondary/50" : "") + (errors.name ? " border-rose-400 focus:border-rose-400 focus:ring-rose-200" : "")} required />
                    {errors.name && <p className="mt-1 text-[11px] font-semibold text-rose-500">{errors.name}</p>}
                  </Field>
                  <Field label="Email" required>
                    <input type="email" value={form.email} readOnly={isAuthenticated} onChange={(e) => { set({ email: e.target.value }); clearError("email"); }} placeholder={t("ins_ph_email")} className={inputCls + (isAuthenticated ? " cursor-not-allowed bg-secondary/50" : "") + (errors.email ? " border-rose-400 focus:border-rose-400 focus:ring-rose-200" : "")} required />
                    {errors.email && <p className="mt-1 text-[11px] font-semibold text-rose-500">{errors.email}</p>}
                  </Field>
                </div>
                {isAuthenticated && (
                  <p className="text-[11px] text-emerald">
                    ✓ {L("Date preluate din contul tău.", "Details pulled from your account.")}
                  </p>
                )}
                <Field label={L("Telefon", "Phone")}>
                  <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder={t("ins_ph_phone")} className={inputCls} />
                </Field>
              </div>
            )}

            {/* Step 1 — Proprietate */}
            {step === 1 && (
              <div className="space-y-4">
                <Field label={L("Adresă / Link anunț", "Address / listing link")} required>
                  <input value={form.address_or_url} onChange={(e) => { set({ address_or_url: e.target.value }); clearError("address_or_url"); }} placeholder={t("ins_ph_addr")} className={inputCls + (errors.address_or_url ? " border-rose-400 focus:border-rose-400 focus:ring-rose-200" : "")} required />
                  {errors.address_or_url && <p className="mt-1 text-[11px] font-semibold text-rose-500">{errors.address_or_url}</p>}
                </Field>
                <Field label={L("Pachet de interes", "Package")}>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PACKAGES.map((p) => {
                      const active = form.package_interest === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => set({ package_interest: p.value })}
                          className={
                            "flex min-h-[56px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition " +
                            (active
                              ? "border-emerald bg-emerald-soft text-emerald shadow-soft ring-1 ring-emerald/30"
                              : "border-border bg-white text-foreground/70 hover:border-emerald/40 dark:bg-card")
                          }
                        >
                          <img src={p.icon} alt="" className="h-9 w-9 shrink-0 object-contain" />
                          <span className="leading-tight">{L(p.value, p.en)}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            )}

            {/* Step 2 — Mesaj */}
            {step === 2 && (
              <div className="space-y-4">
                <Field label={L("Mesaj", "Message")}>
                  <textarea value={form.message} onChange={(e) => set({ message: e.target.value })} rows={5} placeholder={t("ins_ph_msg")} className={inputCls} />
                </Field>
                {/* Summary */}
                <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">{L("Rezumat", "Summary")}</p>
                  <ul className="space-y-1.5 text-sm text-foreground/80">
                    {[
                      // role/package are stored in Romanian (that string goes to
                      // InspectionRequest) — map back to the display label so the
                      // summary is not half-Romanian in EN mode.
                      t(ROLES.find((r) => r.value === form.role)?.labelKey || "ins_role_owner"),
                      form.name || "—",
                      form.email || "—",
                      (() => {
                        const pk = PACKAGES.find((p) => p.value === form.package_interest);
                        return pk ? L(pk.value, pk.en) : "";
                      })(),
                    ].filter(Boolean).map((line, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-emerald" aria-hidden="true">✓</span> {line}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-center text-[11px] text-muted-foreground">{t("ins_footer")}</p>
              </div>
            )}
          </div>

          {/* Nav */}
          <div className="flex shrink-0 items-center gap-3 border-t border-border/60 bg-background px-5 py-3">
            <Button type="button" variant="outline" onClick={back} className="min-h-[48px] gap-1.5 rounded-full">
              <ArrowLeft className="h-4 w-4" /> {step === 0 ? t("ins_close") : t("up_back")}
            </Button>
            {/* Cele doua butoane stateau pe aceeasi pozitie JSX fara `key`, deci
                React refolosea acelasi nod DOM si ii muta doar type-ul,
                "button" -> "submit", in mijlocul click-ului. Browserul rula apoi
                trimiterea formularului ca activation behaviour a ACELUIASI
                click: „Continua" pe pasul 2 avansa SI trimitea, cu `message`
                gol. `key` distinct opreste refolosirea nodului; ultimul buton
                cheama `submit` direct, ca sa nu mai existe cale implicita. */}
            {step < STEPS.length - 1 ? (
              <Button key="next" type="button" onClick={next} className="min-h-[48px] flex-1 gap-1.5 rounded-full bg-emerald text-white shadow-soft hover:bg-emerald/90">
                {L("Continuă", "Continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button key="submit" type="button" onClick={submit} disabled={sending} className="min-h-[48px] flex-1 gap-2 rounded-full bg-emerald text-white shadow-soft hover:bg-emerald/90 disabled:opacity-60">
                <Send className="h-4 w-4" /> {sending ? t("ins_sending") : t("ins_btn")}
              </Button>
            )}
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
}