import React, { useState, useEffect } from "react";
import { Star, X, Loader2, BadgeCheck, MessageSquare, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useCountry } from "@/components/CountryContext";
import { useHasConversation } from "@/hooks/useRatings";
import { StarPicker } from "@/components/RatingStars";
import { initials, avatarColor } from "@/lib/chatUtils";

// Modal for submitting or editing a review about a user (owner/agent).
// Anti-abuse rules:
// 1. Cannot review yourself (enforced by caller — button hidden on own profile)
// 2. One review per reviewer→target pair (existing review is loaded and edited)
// 3. Verified badge only if a conversation exists between the two users
// 4. Must be authenticated
export default function ReviewModal({ targetUser, onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, lang } = useCountry();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const hasConversation = useHasConversation(targetUser?.id, user?.id);
  const en = lang === "en";

  // Check if user already reviewed this person (one review per pair)
  useEffect(() => {
    if (!user || !targetUser) return;
    let cancelled = false;
    setLoadingExisting(true);
    (async () => {
      try {
        const list = await base44.entities.Rating.filter(
          { target_user_id: targetUser.id, reviewer_user_id: user.id },
          "-created_date",
          1
        );
        if (!cancelled && list.length > 0) {
          setExistingReview(list[0]);
          setRating(list[0].rating || 0);
          setComment(list[0].comment || "");
        }
      } catch (e) {} finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, targetUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast({ title: t("rv_select_rating"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        target_user_id: targetUser.id,
        reviewer_user_id: user.id,
        reviewer_name: user.full_name || user.email,
        reviewer_avatar_url: user.avatar_url || "",
        rating,
        comment: comment.trim(),
        is_verified: hasConversation,
      };
      if (existingReview) {
        await base44.entities.Rating.update(existingReview.id, payload);
      } else {
        await base44.entities.Rating.create(payload);
        // Notify the reviewed user (email + in-app). Best-effort, non-blocking.
        try {
          base44.functions.invoke("NotifyOnNewReview", {
            target_user_id: targetUser.id,
            reviewer_user_id: user.id,
            reviewer_name: user.full_name || user.email,
            rating,
            comment: comment.trim(),
            is_verified: hasConversation,
          }).catch(() => {});
        } catch (_) {}
      }
      toast({ title: existingReview ? (en ? "Review updated" : "Recenzie actualizata") : t("rv_submitted") });
      onClose();
    } catch (err) {
      toast({ title: t("rv_error"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 shadow-soft sm:rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-navy dark:text-foreground">
            {existingReview ? (en ? "Edit your review" : "Editeaza recenzia") : t("rv_title")}
          </h3>
          <button onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Target user */}
        <div className="mb-4 flex items-center gap-3 rounded bg-secondary/50 p-3">
          {targetUser?.avatar_url ? (
            <img src={targetUser.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(targetUser?.id)}`}>
              {initials(targetUser?.full_name)}
            </span>
          )}
          <div>
            <p className="font-semibold text-navy dark:text-foreground">{targetUser?.full_name || targetUser?.email}</p>
            <p className="text-xs text-muted-foreground">{targetUser?.seller_type === "Agent" ? t("up_agent") : t("up_landlord")}</p>
          </div>
        </div>

        {loadingExisting ? (
          <div className="flex justify-center py-6 sm:py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald" /></div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Conversation requirement notice */}
            {!hasConversation && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {en
                    ? "You haven't chatted with this user yet. Your review will be marked as unverified. Start a conversation first for a verified review."
                    : "Nu ai avut o conversatie cu acest utilizator inca. Recenzia ta va fi marcata ca neverificata. Începe o conversatie pentru o recenzie verificata."}
                </span>
              </div>
            )}

            {/* Star picker */}
            <div className="mb-4">
              <p className="mb-2 text-sm font-semibold text-navy dark:text-foreground">{t("rv_your_rating")}</p>
              <StarPicker value={rating} onChange={setRating} />
            </div>

            {/* Comment */}
            <div className="mb-4">
              <p className="mb-2 text-sm font-semibold text-navy dark:text-foreground">{t("rv_comment")} <span className="text-muted-foreground">({t("rv_optional")})</span></p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={t("rv_comment_ph")}
                className="w-full resize-none rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/40"
              />
            </div>

            {/* Verified badge info */}
            {hasConversation && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-soft px-3 py-2 text-xs text-emerald">
                <BadgeCheck className="h-4 w-4" /> {t("rv_verified_expl")}
              </div>
            )}

            {/* Anti-abuse note */}
            <div className="mb-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {en
                ? "One review per user. You can edit your review at any time."
                : "O recenzie per utilizator. Poti edita recenzia oricând."}
            </div>

            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="flex w-full items-center justify-center gap-2 rounded bg-emerald py-3 text-sm font-bold text-white shadow-soft transition hover:bg-emerald/90 disabled:opacity-50"
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("rv_submitting")}</>
                : <><Star className="h-4 w-4 fill-white" /> {existingReview ? (en ? "Update review" : "Actualizeaza") : t("rv_submit")}</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}