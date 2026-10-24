import React, { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Fotografia din hero: doar fotografia. Colțarele de vizor, codul proprietății
// și marcajele mono au dispărut — clientul a cerut explicit să nu mai apară
// ID-uri peste poze. Ce rămâne e o trecere lentă printr-un set de imagini
// reale, cu un zoom foarte lent care ține cadrul viu.
// Doar fotografii românești din setul generat — vilele mediteraneene cu
// palmieri au ieșit din rotație, nu vindem chirii în Malaga.
const HEROES = [
  "/images/properties/exterior-02.webp",
  "/images/properties/interior-01.webp",
  "/images/properties/exterior-04.webp",
  "/images/properties/interior-08.webp",
  "/images/properties/exterior-06.webp",
];

export default function HeroPhoto({ className = "", rounded = true }) {
  const [idx, setIdx] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return undefined;
    const id = setInterval(() => setIdx((i) => (i + 1) % HEROES.length), 6000);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div className={`relative overflow-hidden bg-navy-deep ${rounded ? "rounded-2xl" : ""} ${className}`}>
      <AnimatePresence initial={false}>
        <motion.img
          key={idx}
          src={HEROES[idx]}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.4, ease: [0.16, 1, 0.3, 1] }, scale: { duration: 7, ease: "linear" } }}
        />
      </AnimatePresence>
    </div>
  );
}
