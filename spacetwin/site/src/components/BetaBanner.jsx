import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useCountry } from "@/components/CountryContext";
import { Button } from "@/components/ui/button";

// Dismissible Beta notice shown once on first homepage visit (localStorage).
// Solid rounded card, a plain emerald chip instead of a stamp, no glass.
export default function BetaBanner() {
  const { t, lang } = useCountry();
  const en = lang === "en";
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("vc_beta_ack")) {
        const tmr = setTimeout(() => setShow(true), 800);
        return () => clearTimeout(tmr);
      }
    } catch { /* noop */ }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem("vc_beta_ack", "1"); } catch { /* noop */ }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-deep/60 p-4"
        >
          <motion.div
            initial={reduced ? false : { y: 20, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vc-beta-title"
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8"
          >
            <button
              onClick={dismiss}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={en ? "Close" : "Închide"}
            >
              <X className="h-5 w-5" />
            </button>

            <span className="inline-flex items-center rounded-full bg-emerald px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
              Beta
            </span>

            <h3 id="vc-beta-title" className="mt-4 font-heading text-2xl font-semibold text-foreground">
              {t("beta_title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("beta_msg")}</p>

            <Button
              onClick={dismiss}
              className="mt-6 min-h-[48px] w-full rounded-full bg-emerald text-primary-foreground hover:bg-emerald/90"
            >
              {t("beta_btn")}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
