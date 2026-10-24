import React, { useRef, useState } from "react";
import { Phone, MessageCircle, Mail, Download, X, BadgeCheck, Calendar, Globe } from "lucide-react";
import { useCountry } from "@/components/CountryContext";
import { initials } from "@/lib/chatUtils";
import RatingStars from "@/components/RatingStars";

// Premium dark business card modal — cover banner with circular avatar
// overlapping the boundary, contact rows on tinted dark-green blocks.
export default function BusinessCard({ user: profile, ratings = [], average = 0, count = 0, onClose }) {
  const { t, lang } = useCountry();
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const en = lang === "en";
  const isAgent = profile?.seller_type === "Agent" || (profile?.role || "").toUpperCase() === "AGENT";

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0a0f0e",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `card-${(profile?.full_name || "verificasa").replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      // best-effort
    } finally {
      setDownloading(false);
    }
  };

  const phone = profile?.phone || null;
  const whatsapp = profile?.whatsapp_phone || null;
  const email = profile?.email || null;
  const memberSince = profile?.created_date
    ? new Date(profile.created_date).toLocaleDateString(en ? "en-GB" : "ro-RO", { month: "long", year: "numeric" })
    : "";

  const contactRows = [
    phone && {
      icon: Phone,
      label: en ? "Phone" : "Telefon",
      value: phone,
      href: `tel:${phone.replace(/\D/g, "")}`,
    },
    whatsapp && {
      icon: MessageCircle,
      label: "WhatsApp",
      value: whatsapp.startsWith("+") ? whatsapp : `+${whatsapp}`,
      href: `https://wa.me/${whatsapp.replace(/\D/g, "")}`,
    },
    email && {
      icon: Mail,
      label: "Email",
      value: email,
      href: `mailto:${email}`,
    },
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* The card itself — dark theme. relative so the avatar can overlap
            the cover/body boundary with an explicit z-index. */}
        <div
          ref={cardRef}
          className="relative overflow-hidden rounded border border-[#2d3736] bg-[#161f1d] shadow-2xl"
        >
          {/* Cover banner — sits behind the avatar (z-0) */}
          <div className="relative z-0 h-32 w-full overflow-hidden bg-[#0f1715]">
            {profile?.cover_image_url ? (
              <img
                src={profile.cover_image_url}
                alt=""
                className="absolute inset-0 h-full w-full"
                style={{ objectFit: "cover", objectPosition: "center" }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#0f1715] to-[#1a2624]" />
            )}
            {/* Dark gradient at bottom for seamless blend into card body */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#161f1d] via-[#161f1d]/30 to-transparent" />
          </div>

          {/* Body */}
          <div className="relative px-5 pb-5">
            {/* Avatar — absolutely positioned so it straddles the cover/body
                boundary. z-10 guarantees it renders ON TOP of the cover. */}
            <div className="absolute left-5 top-0 z-10 -translate-y-1/2">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-20 w-20 rounded-full border-4 border-[#161f1d] shadow-lg"
                  style={{ objectFit: "cover", objectPosition: "center" }}
                />
              ) : (
                <span className={`flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#161f1d] text-2xl font-bold text-white shadow-lg ${isAgent ? "bg-navy" : "bg-emerald"}`}>
                  {initials(profile?.full_name || profile?.email)}
                </span>
              )}
            </div>

            {/* Name block — pushed right so it clears the avatar */}
            <div className="flex items-end gap-3 pt-10 pl-[5.5rem]">
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate font-heading text-lg font-bold text-white">{profile?.full_name || profile?.email}</h3>
                  {profile?.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald" />}
                </div>
                <p className="text-xs text-[#a0a0a0]">
                  {isAgent ? t("up_agent") : t("up_landlord")}
                  {isAgent && profile?.agency_name ? ` · ${profile.agency_name}` : ""}
                </p>
              </div>
            </div>

            {/* Rating row */}
            <div className="mt-3 flex items-center gap-2">
              <RatingStars rating={count > 0 ? average : 1} size="sm" />
              <span className="text-sm font-bold text-white">
                {count > 0 ? average.toFixed(1) : "1.0"}
              </span>
              <span className="text-xs text-[#a0a0a0]">
                · {count} {count === 1 ? (en ? "review" : "recenzie") : (en ? "reviews" : "recenzii")}
              </span>
            </div>

            {/* Contact rows — tinted dark-green blocks */}
            {contactRows.length > 0 && (
              <div className="mt-4 space-y-2">
                {contactRows.map((row, i) => {
                  const Ico = row.icon;
                  return (
                    <a
                      key={i}
                      href={row.href}
                      target={row.href.startsWith("http") ? "_blank" : undefined}
                      rel={row.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="flex items-center gap-3 rounded border border-[#2d3736] bg-[#1a2624] px-3 py-2.5 transition hover:border-emerald/40"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald text-white">
                        <Ico className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a0a0a0]">{row.label}</p>
                        <p className="truncate text-sm font-semibold text-white">{row.value}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Footer meta */}
            <div className="mt-4 flex items-center justify-between border-t border-[#2d3736] pt-3 text-[11px] text-[#a0a0a0]">
              {memberSince && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {t("up_member_since")} {memberSince}
                </span>
              )}
              <span className="flex items-center gap-1 font-semibold text-emerald">
                <Globe className="h-3 w-3" /> VerifiCasa
              </span>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-[#2d3736] bg-[#1a2624] py-2.5 text-sm font-semibold text-white hover:bg-[#24333]"
          >
            <span className="flex items-center justify-center gap-1.5">
              <X className="h-4 w-4" /> {en ? "Close" : "Închide"}
            </span>
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 rounded bg-emerald py-2.5 text-sm font-bold text-white hover:bg-emerald/90 disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Download className="h-4 w-4" /> {downloading ? "..." : (en ? "Download" : "Descarcă")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}