import React, { useState } from "react";
import { Send } from "lucide-react";
import EmailDirectory from "@/components/EmailDirectory";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useCountry } from "@/components/CountryContext";
import { Reveal } from "@/components/ui/reveal";

const INBOX = "contact@verificasa.ro";

const CONTENT = {
  ro: {
    title: "Contact",
    lede: "Scrie-ne. Răspundem în maximum 48 de ore lucrătoare.",
    form_h: "Trimite-ne un mesaj",
    name: "Nume",
    name_ph: "Numele tău",
    email: "Email",
    email_ph: "adresa@exemplu.ro",
    topic: "Subiect",
    topics: [
      { value: "Contact general", label: "Contact general" },
      { value: "Reclamație", label: "Reclamație sau anunț suspect" },
      { value: "Parteneriat", label: "Parteneriat / B2B" },
      { value: "Presă", label: "Presă și marketing" },
      { value: "Cariere", label: "Cariere" },
      { value: "Legal / GDPR", label: "Legal și date personale" },
    ],
    message: "Mesaj",
    message_ph: "Spune-ne cu ce te putem ajuta.",
    submit: "Trimite mesajul",
    ok_t: "Mesaj pregătit",
    ok_d: "Ți-am deschis clientul de email cu mesajul completat.",
    err_t: "Completează câmpurile",
    err_d: "Avem nevoie de nume, un email valid și un mesaj.",
    dirlead: "Sau scrie direct departamentului potrivit.",
    gdpr_h: "Date personale și ștergerea contului",
    gdpr_p: "Cereri GDPR la",
    gdpr_link: "Ștergerea datelor",
    social_h: "Conturi oficiale",
    domain: "Domeniu verificat: www.verificasa.ro",
    coverage_h: "Acoperire",
    coverage_p: "Toată România, cu verificare online pentru fiecare anunț.",
    time_h: "Timp de răspuns",
    time_p: "Maximum 48 de ore lucrătoare. Cererile GDPR, în maximum 30 de zile.",
  },
  en: {
    title: "Contact",
    lede: "Write to us. We reply within 48 working hours.",
    form_h: "Send us a message",
    name: "Name",
    name_ph: "Your name",
    email: "Email",
    email_ph: "you@example.com",
    topic: "Topic",
    topics: [
      { value: "General", label: "General enquiry" },
      { value: "Complaint", label: "Complaint or suspicious listing" },
      { value: "Partnership", label: "Partnership / B2B" },
      { value: "Press", label: "Press and marketing" },
      { value: "Careers", label: "Careers" },
      { value: "Legal / GDPR", label: "Legal and personal data" },
    ],
    message: "Message",
    message_ph: "Tell us how we can help.",
    submit: "Send message",
    ok_t: "Message ready",
    ok_d: "We opened your email client with the message filled in.",
    err_t: "Fill in the fields",
    err_d: "We need a name, a valid email and a message.",
    dirlead: "Or write straight to the right department.",
    gdpr_h: "Personal data and account deletion",
    gdpr_p: "GDPR requests go to",
    gdpr_link: "Data deletion",
    social_h: "Official accounts",
    domain: "Verified domain: www.verificasa.ro",
    coverage_h: "Coverage",
    coverage_p: "All of Romania, with an online check on every listing.",
    time_h: "Response time",
    time_p: "Within 48 working hours. GDPR requests within 30 days.",
  },
};

const EMPTY = { name: "", email: "", message: "" };

const FIELD =
  "h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground " +
  "placeholder:text-muted-foreground focus:border-emerald focus:outline-none focus:ring-2 " +
  "focus:ring-emerald/25 disabled:opacity-50";

const LABEL = "mb-1.5 block text-sm font-semibold text-navy dark:text-foreground";

function InfoCard({ icon, title, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <img src={icon} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />
      <h2 className="mt-3 font-heading text-base font-bold text-navy dark:text-foreground">{title}</h2>
      <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export default function Contact() {
  const { lang } = useCountry();
  const { toast } = useToast();
  const c = CONTENT[lang] || CONTENT.ro;
  const [form, setForm] = useState(EMPTY);
  // Topic is held as an index so switching RO/EN never leaves the select unmatched.
  const [topicIdx, setTopicIdx] = useState(0);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

    if (!name || !validEmail || !message) {
      toast({ title: c.err_t, description: c.err_d, variant: "destructive" });
      return;
    }

    const topic = (c.topics[topicIdx] || c.topics[0]).value;
    const subject = encodeURIComponent(`[${topic}] ${name}`);
    const body = encodeURIComponent(`${message}\n\n—\n${name}\n${email}`);
    window.location.href = `mailto:${INBOX}?subject=${subject}&body=${body}`;
    toast({ title: c.ok_t, description: c.ok_d });
    // Formularul NU se goleste. `mailto:` nu raspunde daca a deschis ceva sau
    // nu, iar pe un desktop fara client de email configurat nu se intampla
    // nimic vizibil — golirea insemna ca omul isi pierdea mesajul scris si nu
    // mai avea ce copia in adresa listata mai jos.
  };

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6 sm:py-14 lg:px-8">
        <Reveal>
          <h1 className="font-heading text-3xl font-bold text-navy dark:text-foreground sm:text-4xl">
            {c.title}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">{c.lede}</p>
        </Reveal>

        {/* FORM */}
        <Reveal delay={0.06} className="mt-8">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7"
          >
            <h2 className="font-heading text-lg font-bold text-navy dark:text-foreground">{c.form_h}</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="vc-name" className={LABEL}>{c.name}</label>
                <input
                  id="vc-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={set("name")}
                  placeholder={c.name_ph}
                  className={FIELD}
                />
              </div>
              <div>
                <label htmlFor="vc-email" className={LABEL}>{c.email}</label>
                <input
                  id="vc-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder={c.email_ph}
                  className={FIELD}
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="vc-topic" className={LABEL}>{c.topic}</label>
              <select
                id="vc-topic"
                name="topic"
                value={topicIdx}
                onChange={(e) => setTopicIdx(Number(e.target.value))}
                className={`${FIELD} vc-select pr-10`}
              >
                {c.topics.map((o, i) => (
                  <option key={o.value} value={i}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label htmlFor="vc-message" className={LABEL}>{c.message}</label>
              <textarea
                id="vc-message"
                name="message"
                rows={5}
                value={form.message}
                onChange={set("message")}
                placeholder={c.message_ph}
                className="min-h-[8rem] w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/25"
              />
            </div>

            <Button
              type="submit"
              className="mt-5 h-12 w-full rounded-full bg-emerald px-7 text-base text-primary-foreground shadow-soft hover:bg-emerald/90 sm:w-auto"
            >
              {c.submit} <Send className="h-4 w-4" />
            </Button>
          </form>
        </Reveal>

        {/* EMAIL DIRECTORY */}
        <Reveal delay={0.06} className="mt-10">
          <p className="text-sm text-muted-foreground">{c.dirlead}</p>
          <EmailDirectory />
        </Reveal>

        {/* SOCIAL */}
        <Reveal delay={0.06} className="mt-8">
          <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">{c.social_h}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href="https://instagram.com/verificasaro"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-4 text-sm font-semibold text-navy transition-colors hover:border-emerald/40 dark:text-foreground"
            >
              <img src="/images/generated/icon-instagram-v1.png" alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain" />
              @verificasaro
            </a>
            <a
              href="https://tiktok.com/@verificasaro"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-4 text-sm font-semibold text-navy transition-colors hover:border-emerald/40 dark:text-foreground"
            >
              <img src="/images/generated/icon-tiktok-v1.png" alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain" />
              @verificasaro
            </a>
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">{c.domain}</p>
        </Reveal>

        {/* PRACTICALITIES */}
        <Reveal delay={0.06} className="mt-8 grid gap-4 sm:grid-cols-3">
          <InfoCard icon="/images/generated/icon-lock.png" title={c.gdpr_h}>
            {c.gdpr_p}{" "}
            <a href="mailto:legal@verificasa.ro" className="font-semibold text-emerald hover:underline">
              legal@verificasa.ro
            </a>
            .{" "}
            <a href="/data-deletion" className="font-semibold text-emerald hover:underline">
              {c.gdpr_link}
            </a>
          </InfoCard>

          <InfoCard icon="/images/generated/icon-map-pin.png" title={c.coverage_h}>
            {c.coverage_p}
          </InfoCard>

          <InfoCard icon="/images/generated/icon-clock.png" title={c.time_h}>
            {c.time_p}
          </InfoCard>
        </Reveal>
      </div>
    </div>
  );
}
