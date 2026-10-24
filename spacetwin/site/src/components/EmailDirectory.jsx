import React, { useState } from "react";
import {
  Headset, ShieldAlert, Handshake, Megaphone, Briefcase,
  Scale, Building2, Mail, Copy, Check, ExternalLink, AlertTriangle,
  BadgeCheck, Instagram,
} from "lucide-react";

const EMAILS = [
  {
    email: "contact@verificasa.ro",
    label: "Contact General",
    desc: "Întrebări generale, informații și direcționare către departamentul potrivit.",
    icon: Headset,
    badge: "Suport",
    accent: "emerald",
    hero: true,
    bg: "/images/generated/illo-contact-v1.png",
  },
  {
    email: "reclamatii@verificasa.ro",
    label: "Reclamații & Sesizări",
    desc: "Raportează o problemă, anunț fraudulos sau comportament abuziv pe platformă.",
    icon: ShieldAlert,
    badge: "Încredere & Siguranță",
    accent: "rose",
    bg: "/images/generated/illo-reclamatii-v1.png",
  },
  {
    email: "parteneri@verificasa.ro",
    label: "Parteneri & B2B",
    desc: "Colaborări, integrări și oportunități de parteneriat strategic.",
    icon: Handshake,
    badge: "B2B",
    accent: "emerald",
    bg: "/images/generated/illo-parteneri-v1.png",
  },
  {
    email: "marketing@verificasa.ro",
    label: "Marketing & Media",
    desc: "Campanii, PR, sponsorizări și solicitări de presă sau interviuri.",
    icon: Megaphone,
    badge: "Media",
    accent: "amber",
    bg: "/images/generated/illo-marketing-v1.png",
  },
  {
    email: "cariere@verificasa.ro",
    label: "Cariere & Angajări",
    desc: "Aplicații, CV-uri și poziții deschise în echipa VerifiCasa.",
    icon: Briefcase,
    badge: "Recrutare",
    accent: "violet",
    bg: "/images/generated/illo-cariere-v1.png",
  },
  {
    email: "legal@verificasa.ro",
    label: "Departament Legal & GDPR",
    desc: "Solicitări privind protecția datelor, ANPC, termeni legali și conformitate.",
    icon: Scale,
    badge: "Legal",
    accent: "slate",
    bg: "/images/generated/illo-legal-v1.png",
  },
  {
    email: "birou@verificasa.ro",
    label: "Secretariat / Birou",
    desc: "Corespondență oficială, facturare și documente administrative.",
    icon: Building2,
    badge: "Admin",
    accent: "emerald",
    bg: "/images/generated/illo-birou-v1.png",
  },
];

const ACCENTS = {
  emerald: { ring: "ring-emerald/30", glow: "shadow-[0_10px_40px_-12px_rgba(0,168,89,0.45)]", iconBg: "bg-emerald-soft text-emerald", badge: "bg-emerald-soft text-emerald border-emerald/20" },
  rose:    { ring: "ring-rose-500/30", glow: "shadow-[0_10px_40px_-12px_rgba(225,80,80,0.4)]", iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300", badge: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/20" },
  amber:  { ring: "ring-amber-500/30", glow: "shadow-[0_10px_40px_-12px_rgba(217,164,65,0.45)]", iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300", badge: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20" },
  violet: { ring: "ring-violet-500/30", glow: "shadow-[0_10px_40px_-12px_rgba(139,92,246,0.4)]", iconBg: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300", badge: "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/20" },
  slate:  { ring: "ring-slate-500/30", glow: "shadow-[0_10px_40px_-12px_rgba(100,116,139,0.4)]", iconBg: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300", badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/20" },
};

function EmailCard({ item, index }) {
  const [copied, setCopied] = useState(false);
  const Icon = item.icon;
  const a = ACCENTS[item.accent] || ACCENTS.emerald;
  const isHero = item.hero;

  const copy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) { /* ignore */ }
  };

  return (
    // Cardul E elementul de grilă (poartă `sm:col-span-2`), deci nu poate fi
    // înfășurat într-un Reveal fără să se mute grila. În schimb a scăpat de
    // framer: `whileInView` îl ținea la `opacity: 0` până rula un cadru, iar
    // când bucla de cadre e sugrumată rămânea invizibil — la fel ca pagina de
    // planuri. Acum intrarea e doar o translație (tailwindcss-animate), deci în
    // cel mai rău caz cardul e împins câțiva pixeli, niciodată ascuns, iar
    // ridicarea la hover e CSS.
    <a
      href={`mailto:${item.email}`}
      style={{ animationDelay: `${(index % 2) * 0.08}s` }}
      className={`group relative flex flex-col gap-3 animate-in slide-in-from-bottom-4 duration-500 hover:-translate-y-1.5 hover:scale-[1.01] overflow-hidden rounded border border-white/50 bg-white/40 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_30px_-14px_rgba(27,34,44,0.18)] transition-all hover:border-gold/50 hover:bg-white/55 dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_36px_-16px_rgba(0,0,0,0.7)] dark:hover:bg-white/[0.08] ${isHero ? "sm:col-span-2 " + a.glow : ""} ${a.ring} hover:ring-2`}
    >
      {item.bg && (
        <img
          src={item.bg}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 -right-6 z-0 h-36 w-36 object-contain opacity-[0.15] transition-transform duration-500 ease-out group-hover:opacity-[0.22] dark:opacity-[0.22] dark:group-hover:opacity-[0.3] sm:h-40 sm:w-40"
        />
      )}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded ${a.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={`inline-flex items-center rounded border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${a.badge}`}>
          {item.badge}
        </span>
      </div>

      <div className="relative z-10">
        <h3 className={`font-heading font-bold text-navy dark:text-foreground ${isHero ? "text-lg" : "text-base"}`}>
          {item.label}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-1.5 truncate font-semibold text-emerald">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-sm">{item.email}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            aria-label="Copiază adresa"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:border-emerald/40 hover:text-emerald"
          >
            {copied ? <Check className="h-4 w-4 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors group-hover:border-emerald/40 group-hover:text-emerald">
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
      {copied && (
        <span className="absolute -top-2 right-3 z-20 rounded bg-emerald px-2 py-0.5 text-[10px] font-bold text-white shadow">
          Copiat!
        </span>
      )}
    </a>
  );
}

function GroupHeader({ icon: Icon, title }) {
  return (
    <div className="col-span-full mb-1 mt-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-gold" />
      <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-navy dark:text-foreground">
        {title}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function EmailDirectory() {
  const hero = EMAILS.filter((e) => e.hero);
  const support = EMAILS.filter((e) => !e.hero && (e.badge === "Încredere & Siguranță"));
  const business = EMAILS.filter((e) => ["B2B", "Media"].includes(e.badge));
  const depts = EMAILS.filter((e) => ["Recrutare", "Legal", "Admin"].includes(e.badge));

  return (
    <div className="relative space-y-6 overflow-hidden rounded p-4 sm:p-6">
      <div className="relative space-y-6">
      {/* Hero email */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {hero.map((e, i) => <EmailCard key={e.email} item={e} index={i} />)}
      </div>

      {/* Direct support */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GroupHeader icon={ShieldAlert} title="Suport Direct & Siguranță" />
        {support.map((e, i) => <EmailCard key={e.email} item={e} index={i} />)}
      </div>

      {/* Business */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GroupHeader icon={Handshake} title="Business & Parteneriate" />
        {business.map((e, i) => <EmailCard key={e.email} item={e} index={i} />)}
      </div>

      {/* Departments */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GroupHeader icon={Building2} title="Departamente & Legal" />
        {depts.map((e, i) => <EmailCard key={e.email} item={e} index={i} />)}
      </div>

      {/* Security warning */}
      {/* Un avertisment de securitate nu are voie să depindă de un cadru de
          animație ca să fie vizibil. */}
      <div className="animate-in slide-in-from-bottom-4 rounded border border-amber-300/50 bg-amber-50/70 p-5 duration-500 dark:border-amber-500/25 dark:bg-amber-500/[0.07]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-bold text-amber-800 dark:text-amber-200">
              Atenție la phishing — Verifică mereu expeditorul
            </p>
            <ul className="space-y-1.5 text-amber-700/90 dark:text-amber-200/80">
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
                <span><strong>Singurele adrese oficiale</strong> sunt cele listate mai sus pe domeniul <span className="font-mono font-semibold">verificasa.ro</span>. Orice alt email este fals și înșelătorie.</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
                <span>Emailurile de sistem (notificări, aprobări, cereri) se vor primi <strong>exclusiv</strong> de la <span className="font-mono font-semibold">birou@verificasa.ro</span>.</span>
              </li>
              <li className="flex items-start gap-2">
                <Instagram className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
                <span>Conturile oficiale de social media sunt <strong>@verificasaro</strong> pe Instagram și <strong>verificasaro</strong> pe TikTok. Nu solicităm niciodată parole sau date bancare prin email sau mesaje.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}