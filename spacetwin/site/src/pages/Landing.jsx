import React from "react";
import { Link } from "react-router-dom";
import { useCountry } from "@/components/CountryContext";
import HeroSearch from "@/components/HeroSearch";
import HeroPhoto from "@/components/HeroPhoto";
import LoopVideo from "@/components/LoopVideo";
import MapSearchCTA from "@/components/MapSearchCTA";
import ActionCards from "@/components/ActionCards";
import ValueProps from "@/components/ValueProps";
import BetaBanner from "@/components/BetaBanner";
import AboutVerifiCasa from "@/components/AboutVerifiCasa";
import RecommendedByPlanSection from "@/components/RecommendedByPlanSection";
import { Reveal } from "@/components/ui/reveal";
import { PARTNERS } from "@/lib/partners";

// Prima pagină, în forma cerută de client: fotografia ocupă ecranul, titlul e
// scurt, căutarea stă imediat sub deget. Fără dateline, fără paragraf de
// introducere, fără ștampile — nimeni nu citește prima pagină, o parcurge.
export default function Landing() {
  const { t, lang } = useCountry();
  const en = lang === "en";
  // Blocul pentru proprietari promite "verificare" — verificarea independentă
  // e facuta de partener, deci sigla lui sta aici, nu doar pe /parteneri.
  const partner = PARTNERS.find((p) => p.id === "residence-vertical");
  const partnerPct = /(\d+)\s*%/.exec(partner?.discount || "");

  return (
    <div>
      <BetaBanner />

      {/* HERO — fotografie pe toată lățimea, text peste ea */}
      <section className="relative">
        <div className="relative h-[46vh] min-h-[326px] max-h-[420px] w-full overflow-hidden sm:h-[66vh] sm:max-h-none sm:min-h-[500px] lg:h-[74vh]">
          {/* Poziționarea vine din wrapper, nu din className-ul pasat: clasa
              `relative` proprie a HeroPhoto câștiga în cascadă peste `absolute`
              și împingea tot textul hero sub fotografie, tăiat de
              overflow-hidden. Telefonul vedea doar poza. */}
          <div className="absolute inset-0">
            <HeroPhoto rounded={false} className="h-full w-full" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/80" />

          <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-5 sm:px-6 sm:pb-12 lg:px-8 lg:pb-16">
            <Reveal>
              <h1 className="hero-ink max-w-[15ch] text-[1.6rem] font-bold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-7xl">
                {t("hero_h1_a")}
              </h1>
              <p className="hero-ink mt-1 max-w-[24ch] text-[13px] font-semibold text-white/90 sm:mt-1.5 sm:text-xl lg:text-2xl">
                {t("hero_h1_b")}
              </p>
            </Reveal>

            <Reveal delay={0.12} className="mt-3 w-full sm:mt-7 lg:max-w-4xl">
              <HeroSearch />
            </Reveal>

            <Reveal delay={0.2} className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-3">
              {/* Butonul principal duce DIRECT în formularul de publicare.
                  Deschidea un pop-up explicativ care se închidea în el însuși,
                  deci apăsai „Adaugă anunț" și nu ajungeai nicăieri. */}
              <Link
                to="/post-property"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-emerald px-5 text-[13px] font-bold text-primary-foreground shadow-lg transition-transform hover:scale-[1.03] sm:min-h-[48px] sm:px-6 sm:text-sm"
              >
                {t("hdr_add")}
              </Link>
              {/* Verificarea o face partenerul, nu noi. Butonul duce la pagina
                  lui, ca al treilea card din ActionCards — nu deschide un
                  formular cu marca VerifiCasa pentru un serviciu care nu e al
                  nostru. */}
              <Link
                to="/parteneri"
                className="inline-flex min-h-[44px] items-center rounded-full border border-white/50 px-5 text-[13px] font-bold text-white backdrop-brightness-90 transition-colors hover:bg-white/15 sm:min-h-[48px] sm:px-6 sm:text-sm"
              >
                {en ? "Request a check" : "Cere o verificare"}
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* THE THREE WAYS IN */}
      <ActionCards />

      {/* ANUNȚURI RECOMANDATE — sus, e ce vine lumea să vadă */}
      <div id="featured" className="pt-2">
        <Reveal className="mx-auto mb-4 max-w-7xl px-4 sm:mb-6 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-foreground sm:text-3xl">{t("featured_h")}</h2>
        </Reveal>
        <RecommendedByPlanSection />
      </div>

      {/* BANDA VIDEO — turul taie pagina dintr-o parte în alta */}
      <Reveal className="overflow-hidden bg-navy-deep">
        <div className="h-36 w-full sm:h-44 lg:h-56">
          <LoopVideo
            src="/videos/hero-walkthrough-v2.mp4"
            poster="/images/hero/villa-living-1.webp"
            objectPosition="center 55%"
            crossfade={0.4}
          />
        </div>
      </Reveal>

      {/* DE CE — iconițe, nu paragrafe */}
      <ValueProps />

      {/* HARTA */}
      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8">
        <Reveal>
          <MapSearchCTA />
        </Reveal>
      </section>


      {/* DESPRE */}
      <AboutVerifiCasa />

      {/* OWNER CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 sm:pb-20 lg:px-8">
        <Reveal className="relative overflow-hidden rounded-2xl">
          <img
            src="/images/generated/owner-cta-bg-mobile-v1.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[65%_center] sm:hidden"
            loading="lazy"
          />
          <img
            src="/images/generated/owner-cta-bg-v1.png"
            alt=""
            className="absolute inset-0 hidden h-full w-full object-cover sm:block"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/95 via-navy-deep/80 to-navy-deep/30" />

          <div className="relative max-w-2xl p-6 sm:p-12">
            <h2 className="text-2xl font-bold leading-tight text-white sm:text-4xl">{t("owner_h")}</h2>

            <div className="mt-5 flex flex-wrap gap-3 sm:mt-7">
              <Link
                to="/parteneri"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-emerald px-6 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                {t("owner_btn_inspectie")}
              </Link>
              <Link
                to="/post-property"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/50 px-6 text-sm font-bold text-white transition-colors hover:bg-white/15"
              >
                {t("owner_btn_listeaza")}
              </Link>
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-x-6 border-t border-white/20 pt-4 sm:mt-8 sm:grid-cols-4">
              {[t("b_verified"), t("b_measure"), t("b_report"), t("b_docs")].map((b) => (
                <li key={b} className="py-1.5 text-xs font-semibold text-white/85">
                  <span className="mr-1.5 text-emerald" aria-hidden="true">✓</span>{b}
                </li>
              ))}
            </ul>

            {/* Cele patru bife de mai sus sunt serviciul partenerului. Sigla lui
                sta sub ele, ca sa nu para ca le facem noi. Varianta alba, direct
                pe navy — fara caseta. */}
            {partner && (
              <Link
                to="/parteneri"
                className="tap-44 mt-4 inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 transition-colors hover:border-white/40 hover:bg-white/10 sm:mt-5"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  {en ? "Verified by" : "Verificat de"}
                </span>
                <img
                  src={partner.logoLight || partner.logo}
                  alt={partner.name}
                  className="h-6 w-auto max-w-[128px] object-contain"
                  loading="lazy"
                />
                {partnerPct && (
                  <span className="rounded-full bg-emerald/25 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    {en ? `${partnerPct[1]}% off` : `${partnerPct[1]}% reducere`}
                  </span>
                )}
              </Link>
            )}
          </div>
        </Reveal>
      </section>
    </div>
  );
}
