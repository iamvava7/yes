import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { LogOut, Check } from "lucide-react";
import { useCountry } from "@/components/CountryContext";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { getPlanMeta } from "@/lib/plans";
import { fetchMyActiveSubscription } from "@/lib/subscriptions";
import AccountLimits from "@/components/AccountLimits";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "admin"];

// Un rând de detaliu al planului: etichetă la stânga, valoarea la dreapta.
function PlanRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-right text-sm font-semibold text-foreground tnum">{value}</p>
    </div>
  );
}

// Planul activ: sursa de adevăr e entitatea Subscription, scrisă doar de
// VerifyCheckoutSession după o plată reușită — niciodată din client.
function MyPlanSection() {
  const { user } = useAuth();
  const { lang } = useCountry();
  const en = lang === "en";
  const [sub, setSub] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) { setSub(null); return undefined; }
    fetchMyActiveSubscription(user.id).then((s) => { if (!cancelled) setSub(s); });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (sub === undefined) {
    return <div className="mb-6 h-28 animate-pulse rounded-2xl border border-border bg-card" />;
  }

  if (!sub) {
    return (
      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="font-heading text-lg font-semibold text-foreground">
          {en ? "No active plan" : "Niciun plan activ"}
        </p>
        <p className="mt-1 max-w-[46ch] text-sm text-muted-foreground">
          {en
            ? "Pick a plan so your listings get more room and a better spot in search."
            : "Alege un plan ca anunțurile tale să aibă mai mult loc și o poziție mai bună în căutare."}
        </p>
        <Link
          to="/upgrade"
          className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full border border-emerald/70 bg-gradient-to-t from-emerald to-emerald/85 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald/40 transition active:scale-[0.99]"
        >
          {en ? "See the plans" : "Vezi planurile"}
        </Link>
      </section>
    );
  }

  const meta = getPlanMeta(sub.plan_id);
  const validUntil = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(en ? "en-GB" : "ro-RO", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 bg-emerald/10 p-4 dark:bg-emerald/15">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{en ? "Your plan" : "Planul tău"}</p>
          <h2 className="truncate font-heading text-xl font-semibold text-foreground">
            {meta?.shortName || meta?.name || sub.plan_id}
          </h2>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-emerald px-3 py-1 text-xs font-bold text-white">
          {en ? "Active" : "Activ"}
        </span>
      </div>
      <div className="divide-y divide-border px-4">
        <PlanRow
          label={en ? "Billing" : "Facturare"}
          value={sub.billing_interval === "yearly" ? (en ? "Yearly" : "Anuală") : (en ? "Monthly" : "Lunară")}
        />
        <PlanRow label={en ? "Active until" : "Activ până la"} value={validUntil || "—"} />
        {sub.amount_ron ? (
          <PlanRow label={en ? "Last payment" : "Ultima plată"} value={`${sub.amount_ron} RON`} />
        ) : null}
      </div>
      <div className="p-4">
        <Link
          to="/upgrade"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:border-emerald hover:text-emerald"
        >
          {en ? "Change plan" : "Schimbă planul"}
        </Link>
      </div>
    </section>
  );
}

export default function Account() {
  const { t, lang, setLang, currency, setCurrency } = useCountry();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();
  const en = lang === "en";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const role = (user?.role || "").toUpperCase();
  const canAdmin = ADMIN_ROLES.includes(role);
  const greeting = user?.full_name || user?.email || (en ? "user" : "utilizator");


  // Confirmarea plății de boost-uri, la revenirea din Stripe.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("boost") !== "success") return;
    const sessionId = params.get("session_id");
    if (sessionId) {
      base44.functions.invoke("VerifyBoostCheckout", { session_id: sessionId })
        .then((res) => {
          const d = res?.data || res || {};
          if (d.ok) {
            toast({
              title: en ? "Boosts added" : "Boost-uri adăugate",
              description: en
                ? `${d.boosts ?? ""} boosts are now available in your account.`.trim()
                : `${d.boosts ?? ""} boost-uri sunt acum disponibile în cont.`.trim(),
            });
          }
        })
        .catch(() => {});
    }
    params.delete("boost"); params.delete("session_id");
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
     
  }, []);

  // Destinațiile contului, ca listă tipărită — nu un grid de plăcuțe colorate.
  const sections = [
    {
      title: en ? "Listings" : "Anunțuri",
      items: [
        { label: en ? "My listings" : "Anunțurile mele", path: "/my-properties" },
        { label: en ? "Add a listing" : "Adaugă un anunț", path: "/post-property" },
        { label: en ? "Saved" : "Salvate", path: "/saved" },
        { label: en ? "Saved searches" : "Căutări salvate", path: "/searches" },
      ],
    },
    {
      title: en ? "Activity" : "Activitate",
      items: [
        { label: en ? "Messages" : "Mesaje", path: "/messages" },
        { label: en ? "Notifications" : "Notificări", path: "/notificari", badge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : null },
        { label: en ? "My reports" : "Rapoartele mele", path: "/my-reports" },
      ],
    },
    {
      title: en ? "Settings" : "Setări",
      items: [
        { label: en ? "All settings" : "Toate setările", path: "/settings" },
        ...(canAdmin ? [{ label: "Admin", path: "/admin" }] : []),
      ],
    },
  ];

  const pickerCls = (active) =>
    `tap-44 flex h-9 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors ${
      active ? "border-emerald bg-emerald text-white" : "border-border bg-background text-foreground hover:border-emerald"
    }`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="truncate font-heading text-2xl font-semibold sm:text-3xl text-foreground">{greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("hdr_myaccount")}</p>
      </header>

      <MyPlanSection />

      {/* Limitele contului + boost-uri (cerere client, pct. 7) */}
      <AccountLimits className="mb-6" />

      {/* Destinații */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {sections.map((sec, si) => (
          <div key={sec.title} className={si > 0 ? "border-t border-border" : undefined}>
            <p className="px-4 pb-1 pt-3 text-xs font-semibold text-muted-foreground">{sec.title}</p>
            <ul className="divide-y divide-border border-t border-border">
              {sec.items.map((it) => (
                <li key={it.path + it.label}>
                  <Link
                    to={it.path}
                    className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    {it.label}
                    <span className="flex items-center gap-2">
                      {it.badge && (
                        <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-emerald px-1.5 text-[10px] font-bold leading-none text-white tnum">
                          {it.badge}
                        </span>
                      )}
                      <span className="text-muted-foreground" aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Preferințe */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {en ? "Preferences" : "Preferințe"}
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">{en ? "Theme" : "Tema"}</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTheme("light")} className={pickerCls(mounted && !isDark)}>
                {en ? "Light" : "Deschisă"} {mounted && !isDark && <Check className="h-4 w-4" />}
              </button>
              <button onClick={() => setTheme("dark")} className={pickerCls(isDark)}>
                {en ? "Dark" : "Întunecată"} {isDark && <Check className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">{t("hdr_currency")}</p>
            <div className="grid grid-cols-2 gap-2">
              {["EUR", "RON"].map((c) => (
                <button key={c} onClick={() => setCurrency(c)} className={pickerCls(currency === c)}>
                  {c} {currency === c && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">{t("hdr_language")}</p>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: "ro", label: "Română" }, { v: "en", label: "English" }].map((l) => (
                <button key={l.v} onClick={() => setLang(l.v)} className={pickerCls(lang === l.v)}>
                  {l.label} {lang === l.v && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">
              {en ? "Cookie settings" : "Setări cookies"}
            </p>
            <button
              onClick={() => window.dispatchEvent(new Event("vc-open-cookie-prefs"))}
              className="tap-44 flex h-9 w-full items-center justify-center rounded-full border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:border-emerald hover:text-emerald"
            >
              {en ? "Manage cookie preferences" : "Gestionează preferințele cookies"}
            </button>
          </div>
        </div>

        <div className="my-4 h-px w-full bg-border" aria-hidden="true" />

        <Button
          variant="outline"
          className="min-h-[44px] w-full rounded-full border-border"
          onClick={() => { logout("/"); }}
        >
          <LogOut className="mr-2 h-4 w-4" /> {t("hdr_logout")}
        </Button>
      </section>
    </div>
  );
}
