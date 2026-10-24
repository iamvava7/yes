import React, { useState } from "react";
import { BadgeCheck, Loader2, CornerDownRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useCountry } from "@/components/CountryContext";
import RatingStars from "@/components/RatingStars";
import { initials, avatarColor } from "@/lib/chatUtils";

// Single review item with optional owner reply + reply form.
export default function ReviewItem({ review, isOwner }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, lang } = useCountry();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localReply, setLocalReply] = useState(review.owner_reply || "");

  const dateLocale = lang === "en" ? "en-GB" : "ro-RO";
  const dateStr = review.created_date
    ? new Date(review.created_date).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })
    : "";

  const submitReply = async () => {
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      await base44.entities.Rating.update(review.id, {
        owner_reply: reply.trim(),
        owner_reply_date: new Date().toISOString(),
      });
      setLocalReply(reply.trim());
      setShowReplyForm(false);
      setReply("");
      toast({ title: t("up_replied") });
    } catch (e) {
      toast({ title: t("rv_error"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded border border-border bg-white p-4 dark:bg-card">
      <div className="flex items-start gap-3">
        {review.reviewer_avatar_url ? (
          <img src={review.reviewer_avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(review.reviewer_user_id)}`}>
            {initials(review.reviewer_name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-navy dark:text-foreground">{review.reviewer_name || "Anonim"}</p>
            {review.is_verified && (
              <span className="flex items-center gap-0.5 rounded bg-emerald-soft px-1.5 py-0.5 text-[10px] font-bold text-emerald">
                <BadgeCheck className="h-3 w-3" /> {t("rv_verified_badge")}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{dateStr}</span>
          </div>
          <div className="mt-1">
            <RatingStars rating={review.rating} size="sm" />
          </div>
          {review.comment && (
            <p className="mt-2 text-sm text-foreground/80">{review.comment}</p>
          )}
        </div>
      </div>

      {/* Owner reply */}
      {localReply && (
        <div className="mt-3 ml-10 rounded bg-secondary/60 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <CornerDownRight className="h-3.5 w-3.5" /> {t("up_replied")}
          </div>
          <p className="mt-1 text-sm text-foreground/80">{localReply}</p>
        </div>
      )}

      {/* Reply form (only for the profile owner who hasn't replied yet) */}
      {isOwner && !localReply && (
        <div className="mt-3 ml-10">
          {!showReplyForm ? (
            <button
              onClick={() => setShowReplyForm(true)}
              className="text-xs font-semibold text-emerald hover:underline"
            >
              {t("up_reply")}
            </button>
          ) : (
            <div>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder={t("up_reply_placeholder")}
                className="w-full resize-none rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/40"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={submitReply}
                  disabled={submitting || !reply.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t("up_reply_send")}
                </button>
                <button
                  onClick={() => setShowReplyForm(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}