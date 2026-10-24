import React from "react";

// Iconițele lucioase din public/images/generated, desenate mereu la fel:
// o casetă pătrată fixă, ca toate să aibă aceeași amprentă optică, plus umbra
// discretă care le desprinde de hârtie. Sunt pur decorative — textul de lângă
// ele spune ce spun și ele — deci nu au alt, iar cititorul de ecran le sare.
export default function Glyph({ src, className = "h-12 w-12" }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`${className} shrink-0 object-contain drop-shadow-[0_4px_10px_rgba(16,24,40,0.16)]`}
    />
  );
}
