import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const CHARS_PER_TICK = 3;
const TICK_MS = 12;
const PREVIEW_LEN = 260;

// Descriere cu efect de "scriere live" (typewriter) la scroll în vizor —
// se scrie doar preview-ul (rapid), iar restul apare instant la "Află mai mult",
// fără să re-anime tot textul de la zero.
export default function PropertyDescription({ text, emptyLabel, moreLabel, lessLabel }) {
  const [expanded, setExpanded] = useState(false);
  const [typedLen, setTypedLen] = useState(0);
  const [started, setStarted] = useState(false);
  const reduceMotion = useReducedMotion();

  const isTruncated = !!text && text.length > PREVIEW_LEN;
  const previewText = isTruncated ? text.slice(0, PREVIEW_LEN).replace(/\s+\S*$/, "") : (text || "");

  useEffect(() => {
    if (!text || !started) return;
    if (reduceMotion) { setTypedLen(previewText.length); return; }
    const id = setInterval(() => {
      setTypedLen((n) => {
        const next = n + CHARS_PER_TICK;
        if (next >= previewText.length) { clearInterval(id); return previewText.length; }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
     
  }, [started, text]);

  if (!text) {
    return <p className="mt-2 text-sm italic text-muted-foreground/70">{emptyLabel}</p>;
  }

  const shownPreview = previewText.slice(0, typedLen);
  const isTyping = started && typedLen < previewText.length;
  const remainder = text.slice(previewText.length);

  return (
    <motion.div onViewportEnter={() => setStarted(true)} viewport={{ once: true, margin: "-60px" }}>
      <p className="mt-2 min-h-[1.5em] whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {shownPreview}
        {isTruncated && !isTyping && !expanded && "…"}
        {isTyping && <span className="ml-0.5 inline-block h-4 w-[2px] -translate-y-0.5 animate-pulse bg-emerald align-middle" />}
        {expanded && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            {remainder}
          </motion.span>
        )}
      </p>
      {isTruncated && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald transition hover:underline"
        >
          {expanded ? lessLabel : moreLabel}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </motion.div>
  );
}
