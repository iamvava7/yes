// #7 — Recenzie nouă → email + notificare către utilizatorul evaluat.
// Respectă preferința email_notify_reviews (default true).
import { client, sendVC, notify, getUserById, APP_URL } from "../../shared/email.js";

export default async function(req) {
  try {
    const base44 = await client(req);

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const targetUserId = body.target_user_id;
    const reviewerId = body.reviewer_user_id || null;
    const reviewerName = body.reviewer_name || "Un utilizator";
    const rating = body.rating || 0;
    const comment = (body.comment || "").trim();
    const isVerified = !!body.is_verified;

    if (!targetUserId) {
      return Response.json({ error: "target_user_id required" }, { status: 400 });
    }
    // Skip self-reviews
    if (reviewerId && reviewerId === targetUserId) {
      return Response.json({ ok: true, skipped: true });
    }

    const targetUser = await getUserById(base44, targetUserId);
    if (!targetUser || !targetUser.email) {
      return Response.json({ ok: true, skipped: true });
    }

    // Respect email preference (default on)
    const emailEnabled = targetUser.email_notify_reviews !== false;

    const stars = "⭐".repeat(Math.min(5, Math.max(1, rating)));
    const subject = `⭐ Ai primit o recenzie nouă (${rating}/5)`;
    const emailContent = {
      category: "review",
      title: "Ai primit o recenzie nouă",
      greeting: "Salut!",
      intro: `${reviewerName} a lăsat o recenzie despre tine pe VerifiCasa.`,
      dataFields: [
        { icon: "👤", label: "De la", value: reviewerName },
        { icon: "⭐", label: "Rating", value: `${stars}  (${rating}/5)` },
        ...(isVerified ? [{ icon: "✅", label: "Verificată", value: "Recenzie confirmată (conversație reală)" }] : []),
        ...(comment ? [{ icon: "💬", label: "Comentariu", value: `„${comment}"` }] : []),
      ],
      ctaLink: `${APP_URL}/profile/${targetUserId}`,
      ctaLabel: "Vezi recenzia",
      closingNote: "Poți răspunde la recenzii direct din pagina ta de profil public.",
    };

    const emailed = emailEnabled
      ? await sendVC(base44, { to: targetUser.email, subject, content: emailContent })
      : false;

    const notified = await notify(base44, {
      user_id: targetUser.id, type: "review",
      text: `${reviewerName} ți-a lăsat o recenzie de ${rating}/5 ⭐`,
      link: `/profile/${targetUser.id}`, actor_name: reviewerName,
    });

    return Response.json({ ok: true, emailed, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}