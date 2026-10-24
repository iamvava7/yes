import React, { useState } from "react";
import { Phone, Lock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

// Masks a phone number until the viewer is logged in.
// Logged out -> shows "0759 ... ..." + "Vezi tot numărul" → goes to login.
// Logged in  -> reveals the full number.
export default function PhoneReveal({ phone, whatsappPhone }) {
  const { user, isAuthenticated } = useAuth();
  const [revealed, setRevealed] = useState(false);
  const raw = phone || whatsappPhone || "";
  const digits = (raw.match(/\d/g) || []).join("");

  // Build a masked preview (e.g. 0759 ... ...)
  const masked = digits.length > 4 ? `${digits.slice(0, 4)} ••• ••${digits.slice(-2)}` : digits;

  if (!raw) return <p className="text-sm text-muted-foreground">Telefon indisponibil</p>;

  if (isAuthenticated && (revealed || true)) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 rounded bg-emerald-soft px-3 py-2 text-sm font-bold text-emerald">
          <Phone className="h-4 w-4" /> {raw}
        </span>
        {whatsappPhone && (
          <a
            href={`https://wa.me/${whatsappPhone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded bg-emerald px-3 py-2 text-sm font-bold text-white transition hover:opacity-90"
          >
            WhatsApp
          </a>
        )}
        <a href={`tel:${digits}`} className="flex items-center gap-2 rounded border border-emerald/40 px-3 py-2 text-sm font-bold text-emerald transition hover:bg-emerald-soft">
          <Phone className="h-4 w-4" /> Sună
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2 rounded border border-border bg-secondary/40 px-3 py-2 text-sm font-semibold text-muted-foreground">
        <Lock className="h-4 w-4" /> {masked}
      </span>
      <button
        onClick={() => (window.location.href = "/login")}
        className="flex items-center gap-1.5 rounded bg-emerald px-3 py-2 text-sm font-bold text-white transition hover:opacity-90"
      >
        <Phone className="h-4 w-4" /> Vezi tot numărul
      </button>
    </div>
  );
}