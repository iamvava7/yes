import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/components/CountryContext";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import Glyph from "@/components/Glyph";
import HeroCountdown from "@/components/HeroCountdown";

// Real photographs, not renders. Used as the supporting strip in the story block.
const STORY_SHOTS = [
  "/images/properties/interior-04.webp",
  "/images/properties/exterior-03.webp",
];

const CONTENT = {
  ro: {
    hero_badge: "Anunțuri verificate în toată România",
    hero_h: "Chirii și vânzări verificate, fără surprize.",
    hero_p: "Verificăm fiecare anunț online, înainte de publicare.",
    cta_search: "Caută proprietăți",
    cta_list: "Publică un anunț",
    pillars_h: "Ce facem",
    pillars: [
      { icon: "/images/generated/icon-shield-check.png", title: "Verificare online", desc: "Poze, acte și preț, înainte de publicare." },
      { icon: "/images/generated/icon-gauge.png", title: "Scor de încredere", desc: "Cât de sigur e anunțul, dintr-o privire." },
      { icon: "/images/generated/icon-users-check.png", title: "Clienți potriviți", desc: "Filtrăm chiriașii și cumpărătorii serioși." },
      { icon: "/images/generated/icon-lock.png", title: "Comisioane corecte", desc: "Condiții clare, fără taxe ascunse." },
    ],
    story_h: "De la o problemă reală la o soluție simplă",
    story_l1: "A pornit de la prieteni care căutau o chirie și pierdeau zile pe anunțuri care ascundeau realitatea.",
    story_l2: "Așa s-a născut VerifiCasa.",
    service_h: "Pentru cine",
    audiences: [
      { icon: "/images/generated/icon-chiriasi.png", title: "Cumpărători și chiriași", desc: "Mai puține drumuri, decizii mai bune." },
      { icon: "/images/generated/icon-proprietari.png", title: "Proprietari și dezvoltatori", desc: "Doar clienți serioși, fără vizionări inutile." },
    ],
    steps_h: "De la anunț la chei",
    steps: [
      { icon: "/images/generated/icon-search.png", title: "Cauți sau publici", desc: "Răsfoiești sau îți listezi locuința în câteva minute." },
      { icon: "/images/generated/icon-document-check.png", title: "Verificare online", desc: "Poze, acte și preț, verificate de noi." },
      { icon: "/images/generated/icon-camera-verify.png", title: "Scor și promovare", desc: "Anunțul primește scorul lui de încredere." },
      { icon: "/images/generated/icon-handshake.png", title: "Contract și chei", desc: "Selectăm clientul potrivit și predăm cheile." },
    ],
    trust: [
      { icon: "/images/generated/icon-gauge.png", title: "Verificare online", desc: "Înainte de publicare." },
      { icon: "/images/generated/icon-document.png", title: "Contracte transparente", desc: "Fără taxe ascunse." },
      { icon: "/images/generated/icon-map-pin.png", title: "Acoperire națională", desc: "Toată România, din prima zi." },
    ],
    faq_h: "Întrebări frecvente",
    faq: [
      { q: "Cum funcționează verificarea?", a: "Verificăm online poze, acte și preț înainte de publicare, apoi anunțul primește un scor de încredere." },
      { q: "Ce este turul 3D?", a: "Un tur pe care proprietarul îl adaugă din aplicația VerifiCasa 3D, disponibil cu Planul Pro." },
      { q: "Cât costă să listez o proprietate?", a: "Publicarea și verificarea de bază sunt gratuite. Planurile plătite sunt detaliate pe pagina de planuri." },
      { q: "În ce orașe sunteți activi?", a: "În toată România. Verificarea se face online, deci funcționează oriunde." },
      { q: "Cum contactez un proprietar sau agent?", a: "Direct din anunț: mesaj, telefon sau WhatsApp. Numărul tău rămâne ascuns până decizi tu." },
      { q: "Pot salva o proprietate sau o căutare?", a: "Da, cu un cont gratuit salvezi proprietăți și căutări întregi." },
    ],
  },
  en: {
    hero_badge: "Verified listings across Romania",
    hero_h: "Verified rentals and sales, no surprises.",
    hero_p: "We check every listing online, before it goes live.",
    cta_search: "Browse properties",
    cta_list: "List a property",
    pillars_h: "What we do",
    pillars: [
      { icon: "/images/generated/icon-shield-check.png", title: "Online verification", desc: "Photos, paperwork and price, before publishing." },
      { icon: "/images/generated/icon-gauge.png", title: "Trust score", desc: "How solid a listing is, at a glance." },
      { icon: "/images/generated/icon-users-check.png", title: "The right clients", desc: "We screen serious tenants and buyers." },
      { icon: "/images/generated/icon-lock.png", title: "Fair fees", desc: "Clear terms, no hidden charges." },
    ],
    story_h: "From a real problem to a simple fix",
    story_l1: "It started with friends hunting for a rental, losing days to listings that hid the truth.",
    story_l2: "That is how VerifiCasa began.",
    service_h: "Who it is for",
    audiences: [
      { icon: "/images/generated/icon-chiriasi.png", title: "Buyers and tenants", desc: "Fewer wasted trips, better decisions." },
      { icon: "/images/generated/icon-proprietari.png", title: "Owners and developers", desc: "Only serious clients, no pointless viewings." },
    ],
    steps_h: "From listing to keys",
    steps: [
      { icon: "/images/generated/icon-search.png", title: "Search or list", desc: "Browse, or list your place in a few minutes." },
      { icon: "/images/generated/icon-document-check.png", title: "Online check", desc: "Photos, paperwork and price, verified by us." },
      { icon: "/images/generated/icon-camera-verify.png", title: "Score and promotion", desc: "The listing gets its trust score." },
      { icon: "/images/generated/icon-handshake.png", title: "Contract and keys", desc: "We pick the right client and hand over." },
    ],
    trust: [
      { icon: "/images/generated/icon-gauge.png", title: "Online verification", desc: "Before anything is published." },
      { icon: "/images/generated/icon-document.png", title: "Transparent contracts", desc: "No hidden fees." },
      { icon: "/images/generated/icon-map-pin.png", title: "Nationwide", desc: "All of Romania, from day one." },
    ],
    faq_h: "Frequently asked questions",
    faq: [
      { q: "How does verification work?", a: "We check photos, paperwork and price online before publishing, then the listing gets a trust score." },
      { q: "What is the 3D tour?", a: "A tour the owner adds from the VerifiCasa 3D app, available on the Pro plan." },
      { q: "What does listing cost?", a: "Publishing and the basic check are free. Paid plans are detailed on the plans page." },
      { q: "Which cities are you in?", a: "All of Romania. Verification is online, so it works anywhere." },
      { q: "How do I contact an owner or agent?", a: "Straight from the listing: message, phone or WhatsApp. Your number stays hidden until you choose." },
      { q: "Can I save a property or a search?", a: "Yes, a free account saves properties and whole searches." },
    ],
  },
};

export default function About() {
  const { lang } = useCountry();
  const reduced = useReducedMotion();
  const c = CONTENT[lang] || CONTENT.ro;

  // One deliberate spring entrance, on the hero only.
  const heroIn = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 22 },
        animate: { opacity: 1, y: 0 },
        transition: { type: "spring", stiffness: 320, damping: 22 },
      };

  return (
    <div className="bg-background">
      {/* HERO — photo leads, one line of copy */}
      <section className="relative overflow-hidden bg-navy-deep text-white">
        <img
          src="/images/generated/about-hero.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/75 via-navy-deep/65 to-navy-deep/95" />
        <div className="relative mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 sm:py-24 lg:px-8">
          <motion.span
            {...heroIn}
            className="inline-flex items-center rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-gold"
          >
            {c.hero_badge}
          </motion.span>
          <motion.h1
            {...heroIn}
            transition={reduced ? undefined : { type: "spring", stiffness: 320, damping: 22, delay: 0.06 }}
            className="mt-5 font-heading text-3xl font-extrabold leading-tight sm:text-5xl"
          >
            {c.hero_h}
          </motion.h1>
          <motion.p
            {...heroIn}
            transition={reduced ? undefined : { type: "spring", stiffness: 320, damping: 22, delay: 0.12 }}
            className="mx-auto mt-4 max-w-md text-base text-white/85 sm:text-lg"
          >
            {c.hero_p}
          </motion.p>
          <motion.div
            {...heroIn}
            transition={reduced ? undefined : { type: "spring", stiffness: 320, damping: 22, delay: 0.18 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
          >
            <Button asChild className="h-12 rounded-full bg-emerald px-7 text-base text-primary-foreground shadow-soft hover:bg-emerald/90">
              <Link to="/search">
                {c.cta_search} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-white/40 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/post-property">{c.cta_list}</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Numărătoarea a venit de pe prima pagină. Acolo stătea între căutare și
          anunțuri, pe drumul cuiva care voia doar să vadă case; aici e la locul
          ei, în pagina care povestește unde suntem cu produsul. */}
      <HeroCountdown className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8" />

      {/* PILLARS */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-16 lg:px-8">
        <Reveal>
          <h2 className="text-center font-heading text-2xl font-bold text-navy dark:text-foreground sm:text-3xl">
            {c.pillars_h}
          </h2>
        </Reveal>
        <RevealGroup className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.pillars.map((p) => (
            <RevealItem
              key={p.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-[0_20px_45px_-15px_rgba(16,24,40,0.28)] sm:p-6"
            >
              <Glyph src={p.icon} />
              <h3 className="mt-4 font-heading text-lg font-bold text-navy dark:text-foreground">{p.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.desc}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* STORY — photos carry it, two lines of copy */}
      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 sm:pb-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <Reveal className="space-y-3">
            <div className="overflow-hidden rounded-2xl shadow-soft">
              <img
                src="/images/generated/about-story.png"
                alt=""
                className="h-48 w-full object-cover sm:h-80 lg:h-[26rem]"
                loading="lazy"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STORY_SHOTS.map((src) => (
                <div key={src} className="overflow-hidden rounded-xl shadow-soft">
                  <img src={src} alt="" className="h-24 w-full object-cover sm:h-28" loading="lazy" />
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="font-heading text-2xl font-bold text-navy dark:text-foreground sm:text-3xl">
              {c.story_h}
            </h2>
            <p className="mt-3 text-base text-muted-foreground">{c.story_l1}</p>
            <p className="mt-2 font-heading text-lg font-bold text-navy dark:text-foreground">{c.story_l2}</p>

            <h3 className="mt-8 font-heading text-sm font-bold uppercase tracking-wide text-emerald">
              {c.service_h}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {c.audiences.map((a) => (
                <div key={a.title} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <Glyph src={a.icon} className="h-10 w-10" />
                  <p className="mt-3 font-heading text-sm font-bold text-navy dark:text-foreground">{a.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* STEPS */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-16 lg:px-8">
        <Reveal>
          <h2 className="text-center font-heading text-2xl font-bold text-navy dark:text-foreground sm:text-3xl">
            {c.steps_h}
          </h2>
        </Reveal>
        <RevealGroup className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.steps.map((s) => (
            <RevealItem
              key={s.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-[0_20px_45px_-15px_rgba(16,24,40,0.28)] sm:p-6"
            >
              {/* Fără număr pe card. Cardurile stau oricum în ordine, de la stânga la
                  dreapta — cifra nu spunea nimic ce nu spunea deja poziția. */}
              <Glyph src={s.icon} className="h-11 w-11" />
              <h3 className="mt-4 font-heading text-base font-bold text-navy dark:text-foreground">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* TRUST BAR */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-16 lg:px-8">
        <Reveal className="rounded-2xl bg-navy-deep p-6 shadow-[0_30px_70px_-30px_rgba(16,24,40,0.5)] sm:p-8">
          <div className="grid gap-5 sm:grid-cols-3">
            {c.trust.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <Glyph src={b.icon} className="h-10 w-10" />
                <div className="min-w-0">
                  <p className="font-heading text-sm font-bold text-white">{b.title}</p>
                  <p className="text-xs text-white/60">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="bg-navy-deep py-8 text-white sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-center font-heading text-2xl font-bold sm:text-3xl">{c.faq_h}</h2>
          </Reveal>
          <RevealGroup className="mt-8" stagger={0.06}>
            <Accordion type="single" collapsible className="space-y-2.5">
              {c.faq.map((item, i) => (
                <RevealItem key={item.q}>
                  <AccordionItem
                    value={`faq-${i}`}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 transition-colors hover:bg-white/[0.07] data-[state=open]:border-emerald/40 data-[state=open]:bg-white/[0.07] sm:px-5"
                  >
                    <AccordionTrigger className="min-h-[56px] font-heading text-base font-semibold text-white hover:text-emerald sm:text-lg">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-white/70">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                </RevealItem>
              ))}
            </Accordion>
          </RevealGroup>
        </div>
      </section>
    </div>
  );
}
