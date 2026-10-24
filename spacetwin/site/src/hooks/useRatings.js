import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";

// Fetches all ratings for a target user and computes aggregate stats.
// Returns { ratings, average, count, distribution, loading }
export function useUserRatings(targetUserId) {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await base44.entities.Rating.filter(
          { target_user_id: targetUserId },
          "-created_date",
          200
        );
        if (!cancelled) setRatings(list);
      } catch (e) {
        if (!cancelled) setRatings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Realtime: new/updated/deleted ratings appear instantly
    const unsubscribe = base44.entities.Rating.subscribe((event) => {
      setRatings((prev) => {
        const p = event.data;
        if (event.type === "delete") return prev.filter((x) => x.id !== event.id);
        if (!p || p.target_user_id !== targetUserId) return prev.filter((x) => x.id !== event.id?.split("-")[0]);
        const idx = prev.findIndex((x) => x.id === p.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = p;
          return next;
        }
        return [p, ...prev];
      });
    });

    return () => { cancelled = true; unsubscribe(); };
  }, [targetUserId]);

  // Progressive stars: starts at 1.0 with no reviews, grows toward the true
  // average as reviews accumulate (Bayesian average with a prior of 1).
  const { average, count, distribution } = useMemo(() => {
    const count = ratings.length;
    if (count === 0) return { average: 1, count: 0, distribution: {} };
    const sum = ratings.reduce((acc, r) => acc + (r.rating || 0), 0);
    const dist = {};
    ratings.forEach((r) => {
      const s = Math.round(r.rating);
      dist[s] = (dist[s] || 0) + 1;
    });
    // (sum + prior) / (count + prior_weight) — starts at 1, approaches true avg
    const progressive = (sum + 1) / (count + 1);
    return { average: progressive, count, distribution: dist };
  }, [ratings]);

  return { ratings, average, count, distribution, loading };
}

// Checks if the current user has had a conversation with the target user
// (used to mark reviews as "verified"). Returns boolean.
export function useHasConversation(targetUserId, currentUserId) {
  const [hasConversation, setHasConversation] = useState(false);

  useEffect(() => {
    if (!targetUserId || !currentUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await base44.entities.Conversation.filter(
          { $or: [
            { buyer_id: currentUserId, seller_id: targetUserId },
            { buyer_id: targetUserId, seller_id: currentUserId },
          ]},
          "-created_date",
          1
        );
        if (!cancelled) setHasConversation(list.length > 0);
      } catch (e) {
        if (!cancelled) setHasConversation(false);
      }
    })();
    return () => { cancelled = true; };
  }, [targetUserId, currentUserId]);

  return hasConversation;
}