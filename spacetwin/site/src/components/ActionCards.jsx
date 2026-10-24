import React from "react";
import { Link } from "react-router-dom";
import { useCountry } from "@/components/CountryContext";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { PARTNERS } from "@/lib/partners";

// Cele trei drumuri în aplicație. Fiecare e o fotografie cu un singur rând de
// text peste ea — se aleg din privire, nu din citit. Paragrafele explicative
// au ieșit; dacă un card are nevoie de trei rânduri ca să se explice, atunci
// cardul e greșit, nu textul prea scurt.
//
// Fotografiile sunt cele trimise de client, iar fișierele se numesc ca locul în
// care stau: cauta-o-chirie.webp stă pe „Caută o chirie". Înainte erau trei
// poze de stoc luate la întâmplare din public/images/properties, deci cardul
// de căutat chirie arăta un living gol.
//
// Al treilea card nu e al nostru. Verificarea o face partenerul, deci cardul
// poartă marca lui și duce la pagina de parteneri, unde stă oferta lui și
// butonul către site-ul lui — nu într-o fereastră cu marca VerifiCasa.
export default function ActionCards() {
  const { lang } = useCountry();
  const en = lang === "en";
  const partner = PARTNERS.find((p) => p.id === "residence-vertical");

  const cards = [
    {
      title: en ? "Find a rental" : "Caută o chirie",
      img: "/images/actions/cauta-o-chirie.webp",
      to: "/search",
    },
    {
      title: en ? "List your place" : "Listează gratuit",
      img: "/images/actions/listeaza-gratuit.webp",
      to: "/post-property",
    },
    {
      title: en ? "Get it verified" : "Cere o verificare",
      partner: true,
      to: "/parteneri",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:pb-8 sm:pt-6 lg:px-8">
      <RevealGroup className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {cards.map((c) => (
          <RevealItem key={c.title}>
            <Link to={c.to} className="block">
              <span className="group relative flex h-32 items-end overflow-hidden rounded-2xl sm:h-44">
                {c.partner ? (
                  <>
                    {/* Verdele e al MĂRCII partenerului (partners.js), nu un
                        token de-al nostru — de-aia stă în style, nu în clase.
                        Spălatul de 12% de dinainte lăsa cardul aproape gol
                        lângă două fotografii întregi. */}
                    <span
                      className="absolute inset-0"
                      style={{ background: `linear-gradient(135deg, ${partner?.brandDeep || "#047857"}, ${partner?.brand || "#059669"})` }}
                    />
                    <span className="absolute inset-x-0 top-0 flex h-full items-center justify-center p-4 pb-14">
                      <img
                        src={partner?.logoLight || partner?.logo}
                        alt={partner?.name || ""}
                        className="max-h-12 w-auto max-w-[62%] object-contain"
                        loading="lazy"
                      />
                    </span>
                  </>
                ) : (
                  <>
                    {/* Fotografia crește puțin sub cursor — atât, un pas, nu
                        o animație. */}
                    <img
                      src={c.img}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  </>
                )}

                <span className="relative flex w-full items-center justify-between gap-2 p-4 sm:p-5">
                  <span className="text-lg font-bold text-white sm:text-xl">
                    {c.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none ${
                      c.partner ? "bg-white text-emerald" : "bg-emerald text-primary-foreground"
                    }`}
                  >
                    →
                  </span>
                </span>
              </span>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
