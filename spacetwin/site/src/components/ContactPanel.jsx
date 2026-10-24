import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Phone, BadgeCheck, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/components/CountryContext";
import { initials } from "@/lib/chatUtils";
import RatingStars from "@/components/RatingStars";
import ReviewModal from "@/components/ReviewModal";
import PartnerBox from "@/components/PartnerBox";

// Panou de contact redesignat — fără formular, doar chat + telefon.
// Înlocuiește vechiul formular de „pre-calificare" cu un card curat tip Zillow.
export default function ContactPanel({ property, ownerUser, onMessage }) {
  const { t } = useCountry();
  const { user } = useAuth();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const p = property;
  const sellerName = p.posted_by_name || p.owner_name || ownerUser?.full_name || t("pc_seller_landlord");
  const sellerRole = p.seller_role || (p.owner_verified ? "Proprietar" : "Agent");
  const isProprietar = sellerRole === "Proprietar";
  const avatarUrl = ownerUser?.avatar_url;
  const targetUserId = p.created_by_id || ownerUser?.id;
  const callPhone = (p.phone || "").replace(/\D/g, "");
  const waPhone = (p.whatsapp_phone || p.phone || "").replace(/\D/g, "");
  const hasPhone = !!callPhone && callPhone.length >= 6;
  const hasWhatsApp = !!waPhone && waPhone.length >= 6;

  // Fetch rating for this owner
  const [ratings, setRatings] = useState([]);
  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await base44.entities.Rating.filter({ target_user_id: targetUserId }, "-created_date", 200);
        if (!cancelled) setRatings(list);
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [targetUserId]);

  const { average, count } = useMemo(() => {
    const c = ratings.length;
    if (c === 0) return { average: 1, count: 0 };
    const sum = ratings.reduce((a, r) => a + (r.rating || 0), 0);
    return { average: (sum + 1) / (c + 1), count: c };
  }, [ratings]);

  const trustMarkers = [
    p.owner_verified && t("badge_owner_v"),
    // „Anunț verificat online" e o afirmație de verificare, deci se ia din
    // verification_level. Pe scor ar apărea la orice anunț bine completat, iar
    // scorul e de completitudine, nu de verificare.
    p.verification_level && p.verification_level !== "unverified" && t("pd_trust_inspection"),
    t("pd_trust_response"),
  ].filter(Boolean);

  return (
    <>
    <div className="rounded-2xl border border-border bg-card">
      <div className="p-4 sm:p-6">
      <h3 className="font-heading text-lg font-semibold text-foreground">{t("contact_h")}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("contact_sub")}</p>

      {/* Agent identity */}
      <Link to={targetUserId ? `/profile/${targetUserId}` : "#"} className="-m-2 mt-3 flex min-h-[64px] items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-secondary">
        <span className="relative shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={sellerName} className="h-14 w-14 rounded-full border border-border object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-secondary text-base font-bold text-foreground">
              {initials(sellerName)}
            </span>
          )}
          {p.owner_verified && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald text-primary-foreground ring-2 ring-card">
              <BadgeCheck className="h-3 w-3" />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground hover:text-emerald">{sellerName}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {isProprietar ? t("pc_seller_landlord") : t("pc_seller_agent")}
          </p>
          {count > 0 && (
            <div className="mt-0.5 flex items-center gap-1">
              <RatingStars rating={average} size="sm" showNumber />
              <span className="text-xs text-muted-foreground">({count})</span>
            </div>
          )}
          {count === 0 && (
            <div className="mt-0.5 flex items-center gap-1">
              <RatingStars rating={1} size="sm" />
              <span className="text-xs text-muted-foreground">{t("up_no_reviews")}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Primary CTA */}
      <Button onClick={onMessage} className="mt-4 min-h-[48px] w-full gap-2 rounded-full bg-emerald text-primary-foreground transition-colors hover:bg-emerald/90" size="lg">
        <MessageCircle className="h-5 w-5" /> {t("pd_msg_btn")}
      </Button>

      {/* Secondary actions */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {hasPhone ? (
          <Button asChild variant="outline" className="min-h-[48px] gap-1.5 rounded-full border-border text-foreground hover:border-emerald hover:text-emerald">
            <a href={`tel:${callPhone}`}><Phone className="h-4 w-4" /> {t("pc_call")}</a>
          </Button>
        ) : (
          <Button variant="outline" disabled className="min-h-[48px] gap-1.5 rounded-full border-border text-muted-foreground">
            <Phone className="h-4 w-4" /> {t("pc_call")}
          </Button>
        )}
        {hasWhatsApp ? (
          <Button asChild variant="outline" className="min-h-[48px] gap-1.5 rounded-full border-border text-foreground hover:border-emerald hover:text-emerald">
            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </Button>
        ) : (
          <Button variant="outline" disabled className="min-h-[48px] gap-1.5 rounded-full border-border text-muted-foreground">
            WhatsApp
          </Button>
        )}
      </div>

      {/* Trust markers — chips soft, fără listă riglată */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {trustMarkers.map((text, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground/80">
            <span className="text-emerald" aria-hidden="true">✓</span> {text}
          </span>
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">{t("pd_trust_footer")}</p>

      {/* Leave review button — visible only for authenticated non-owner users */}
      {user && targetUserId && user.id !== targetUserId && ownerUser && (
        <button
          onClick={() => setShowReviewModal(true)}
          className="mt-3 tap-44 flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-full border border-border text-xs font-semibold text-emerald transition-colors hover:border-emerald hover:bg-secondary"
        >
          <Star className="h-3.5 w-3.5" /> {t("up_leave_review")}
        </button>
      )}

      {showReviewModal && ownerUser && (
        <ReviewModal targetUser={ownerUser} onClose={() => setShowReviewModal(false)} />
      )}
      </div>
    </div>
    {/* Caseta partenerului stă imediat sub „Contactează & Programează" */}
    <PartnerBox className="mt-4" />
    </>
  );
}