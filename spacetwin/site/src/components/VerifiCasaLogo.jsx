import React from "react";

// Sigla oficială VerifiCasa, fișierele primite de la client.
//
// Marca e un lockup „VC": V-ul e bifa din stânga, C-ul din dreapta cuprinde o
// casă cu fereastră. Nu conține text — cuvântul „VerifiCasa" se scrie alături,
// aici, cu fontul aplicației.
//
// Două fișiere, nu unul recolorat: alb pentru fundaluri închise (subsol, peste
// fotografii), negru pentru hârtie. Se folosesc CA ATARE, prin <img> — nu le
// recolorăm și nu le redesenăm, ca să rămână exact artwork-ul oficial.
//
// viewBox-ul fișierelor din public/ e strâns pe conturul desenului
// (58.3 102.9 345 230.2, măsurat cu getBBox pe fiecare formă vizibilă).
// Originalele aveau pânza de 432×432 cu desenul descentrat în ea, deci sigla
// s-ar fi văzut la ~53% din casetă și lipită spre dreapta. Raportul e 3:2.

const MARK_DARK = "/images/brand/verificasa-mark.svg";
const MARK_LIGHT = "/images/brand/verificasa-mark-white.svg";

// lățime / înălțime, din viewBox-ul de mai sus
const MARK_RATIO = 345 / 230.2;

// Sigla trebuie să urmeze TEMA, nu un prop scris de mână.
//
// Antetul are `bg-background`, care în modul întunecat e aproape negru. Cu
// varianta neagră fixată acolo, sigla dispărea în bară — negru pe negru — în
// timp ce cuvântul de lângă ea se albea singur, pentru că textul folosește
// `text-foreground`. De aceea clientul a trimis DOUĂ fișiere.
//
// Schimbarea se face din CSS, cu `dark:`, nu citind tema din JS: amândouă
// imaginile stau în pagină și una e ascunsă. Așa nu există niciun cadru în care
// se vede sigla greșită cât timp se hidratează tema, iar `next-themes` pune deja
// clasa `dark` pe <html> (tailwind.config.js: darkMode: ["class"]).
//
// `tone="light"` rămâne o alegere fermă: alb mereu, indiferent de temă — pentru
// subsolul pe tuș și pentru siglele așezate peste fotografii, unde fundalul e
// închis în ambele teme.

export default function VerifiCasaLogo({
  size = 40,
  withWordmark = true,
  wordmark, // alias vechi — wordmark={false} înseamnă doar sigla
  tagline = false,
  tone = "dark", // dark = tuș pe hârtie, light = alb peste fotografie/fundal închis
  className = "",
}) {
  const showWordmark = wordmark === false ? false : withWordmark;

  // Sigla e lată (3:2), deci înălțimea o dă `size`, nu lățimea — altfel ar
  // crește peste rândul în care stă.
  const markH = Math.round(size * 0.62);
  const markW = Math.round(markH * MARK_RATIO);
  const box = { width: markW, height: markH };

  const markImg = (src, extra) => (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={markW}
      height={markH}
      className={`shrink-0 object-contain ${extra}`}
      style={box}
    />
  );

  const Mark =
    tone === "light" ? (
      markImg(MARK_LIGHT, "")
    ) : (
      // Negru pe hârtie, alb pe noapte. Clasele sunt literale, ca Tailwind să
      // nu le curețe la build.
      <>
        {markImg(MARK_DARK, "dark:hidden")}
        {markImg(MARK_LIGHT, "hidden dark:block")}
      </>
    );

  // Doar sigla — acolo unde spațiul e strâns (avatarul din conversații).
  if (!showWordmark) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        role="img"
        aria-label="VerifiCasa"
      >
        {Mark}
      </span>
    );
  }

  // „Casa" e verde ORIUNDE. Pe tuș era alb-80%, deci sigla din subsol nu semăna
  // cu cea din antet: sus verde, jos gri. Verdele din token urmează tema, iar pe
  // fundal de tuș varianta de zi (#1F7048) e prea închisă ca să se citească —
  // pe `tone="light"` folosim verdele de noapte, literal, ca Tailwind să nu-l
  // curețe la build.
  const inkCls = tone === "light" ? "text-white" : "text-foreground";
  const casaCls = tone === "light" ? "text-[#37A06B]" : "text-emerald";
  const fs = Math.round(size * 0.52);

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 ${className}`}
      role="img"
      aria-label="VerifiCasa"
    >
      {Mark}
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate font-body font-black" style={{ fontSize: fs, letterSpacing: "-0.025em" }}>
          <span className={inkCls}>Verifi</span>
          <span className={casaCls}>Casa</span>
        </span>
        {tagline && (
          <span
            className={`mt-1 text-[10px] font-semibold ${tone === "light" ? "text-white/70" : "text-muted-foreground"}`}
          >
            Inspecții și verificări imobiliare
          </span>
        )}
      </span>
    </span>
  );
}
