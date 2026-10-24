import React from "react";
import { cn } from "@/lib/utils";

// O bandă de fotografii care se plimbă încet spre stânga, la nesfârșit.
//
// Lista se desenează de DOUĂ ori, una după alta, iar pista se translatează cu
// exact -50% din lățimea ei: în clipa în care se termină prima copie, a doua e
// fix acolo unde era prima la început, deci bucla nu are cusătură.
//
// Regula casei, la fel ca la meniu și la reveal: animația atinge DOAR
// `transform`, niciodată opacitatea. Dacă bucla de cadre e sugrumată — filă în
// fundal, iframe-ul editorului Base44, telefon încetinit — banda rămâne o
// fotografie oprită, nu o casetă goală. Reducerea de mișcare e tratată global
// în index.css, care oprește animația în loc să ascundă conținutul.
//
// `aria-hidden` pe tot: sunt fotografii decorative, iar un cititor de ecran
// n-are ce face cu șaisprezece „fațadă de imobil".
export default function PhotoMarquee({
  images,
  className,
  itemClassName = "w-36 sm:w-44",
  seconds = 42,
}) {
  const track = [...images, ...images];

  return (
    <div className={cn("relative overflow-hidden", className)} aria-hidden="true">
      <div
        className="vc-marquee flex h-full w-max gap-px"
        style={{ animationDuration: `${seconds}s` }}
      >
        {track.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            loading={i < images.length ? "eager" : "lazy"}
            className={cn("h-full shrink-0 object-cover", itemClassName)}
          />
        ))}
      </div>
    </div>
  );
}
