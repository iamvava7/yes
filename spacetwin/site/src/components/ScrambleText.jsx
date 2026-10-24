import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Un cuvânt care se rostogolește prin litere întâmplătoare și apoi se așază.
//
// Regula casei, aceeași ca peste tot în aplicație: starea de REPAUS e cea
// FINALĂ. `display` pornește chiar de la textul corect, iar amestecul îl
// înlocuiește doar după ce un `setTimeout` a apucat să ruleze. Dacă bucla de
// cadre e sugrumată sau utilizatorul a cerut mai puțină mișcare, în locul
// efectului rămâne pur și simplu cuvântul — niciodată o casetă goală sau o
// grămadă de litere blocate.
//
// Literele se fixează de la stânga la dreapta, nu toate deodată la final:
// altfel efectul se citește ca o eroare care se corectează brusc, nu ca un
// cuvânt care se așază.
//
// Lățimea e rezervată de o copie invizibilă a textului final, ca insigna din
// jur să nu pulseze cât timp literele se schimbă. Spațiile nu se amestecă —
// „pentru tine" trebuie să rămână două cuvinte pe tot parcursul.

const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export default function ScrambleText({
  text,
  className,
  tickMs = 45,
  ticks = 22,
  delayMs = 320,
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(text);
  const timers = useRef([]);

  useEffect(() => {
    setDisplay(text);
    if (reduced) return undefined;

    const chars = Array.from(text);
    let t = 0;

    const clear = () => {
      timers.current.forEach((id) => clearTimeout(id));
      timers.current.forEach((id) => clearInterval(id));
      timers.current = [];
    };

    const startId = setTimeout(() => {
      const id = setInterval(() => {
        t += 1;
        const locked = Math.floor((t / ticks) * chars.length);
        setDisplay(
          chars
            .map((ch, i) => {
              if (i < locked || ch === " ") return ch;
              return POOL[Math.floor(Math.random() * POOL.length)];
            })
            .join(""),
        );
        if (t >= ticks) {
          clearInterval(id);
          setDisplay(text);
        }
      }, tickMs);
      timers.current.push(id);
    }, delayMs);
    timers.current.push(startId);

    return clear;
  }, [text, reduced, tickMs, ticks, delayMs]);

  return (
    <span className={cn("relative inline-block whitespace-pre", className)}>
      {/* rezervă lățimea cuvântului final, ca insigna să nu se lățească și să
          se strângă la fiecare literă schimbată */}
      <span className="invisible" aria-hidden="true">{text}</span>
      <span className="absolute inset-0" aria-hidden="true">{display}</span>
      {/* cititorul de ecran primește cuvântul, nu amestecul */}
      <span className="sr-only">{text}</span>
    </span>
  );
}
