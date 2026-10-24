import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendVC, getUserById, APP_URL } from "../../shared/email.js";
import { stampPosterPlan, getEntitlements } from "../../shared/entitlements.js";
import { addCredits } from "../../shared/boosts.js";

// Webhook Stripe — singurul loc unde aplicația AFLĂ ce se întâmplă cu un
// abonament DUPĂ prima plată (reînnoiri, anulări, plăți eșuate). Până acum
// nimic din asta nu ajungea în aplicație: VerifyCheckoutSession vede doar
// prima plată, prin redirectul de succes.
//
// De configurat manual, o singură dată, în afara acestui fișier:
//   1. Secretul StripeWebhookSecret — din Stripe Dashboard → Developers →
//      Webhooks → (creezi endpoint-ul) → Signing secret (whsec_...).
//   2. URL-ul endpoint-ului în Stripe Dashboard: URL-ul public al acestei
//      funcții (din Base44, tab-ul Functions → StripeWebhook).
//   3. Evenimentele de ascultat: invoice.paid, customer.subscription.updated,
//      customer.subscription.deleted.
//
// Ce face fiecare eveniment:
//   invoice.paid                 — reînnoire reușită: prelungește
//                                  current_period_end. Dacă abonamentul era
//                                  cancelled/expired și tocmai s-a replătit,
//                                  redevine active și badge-ul reapare.
//                                  Reînnoirile REALE (billing_reason =
//                                  subscription_cycle în Stripe, nu prima
//                                  factură) recreditează boostsIncluded din
//                                  plan (decizia clientului, 23.08: "de
//                                  fiecare dată când cineva reînnoiește,
//                                  primește un recharge la tot ce conține
//                                  planul"). Prima factură e deja acoperită
//                                  de VerifyCheckoutSession, deci nu se
//                                  dublează aici.
//   customer.subscription.updated — dacă status-ul Stripe e canceled/unpaid/
//                                  past_due: badge-ul dispare + email.
//   customer.subscription.deleted — abonamentul s-a încheiat definitiv:
//                                  badge-ul dispare + email.
//
// stampPosterPlan (pune/scoate poster_plan de pe anunțurile unui utilizator)
// vine din shared/entitlements.js — aceeași funcție o folosește și
// AdminGrantPlan, ca să nu existe două copii care se pot dezacorda.

const STATUS_MAP: Record<string, string> = {
  active: "active",
  trialing: "active",
  canceled: "cancelled",
  unpaid: "expired",
  past_due: "expired",
  incomplete_expired: "expired",
};

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k] = v;
  }
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  // Fereastra de toleranță standard Stripe — respinge evenimente vechi (replay).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const hex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

async function notifyLostPlan(base44: any, userId: string, planLabel: string, reason: "cancelled" | "unpaid") {
  try {
    await base44.asServiceRole.entities.Notification.create({
      user_id: userId,
      type: "system",
      text: reason === "unpaid"
        ? `Plata pentru ${planLabel} nu a trecut — abonamentul și badge-ul s-au dezactivat.`
        : `Abonamentul ${planLabel} s-a anulat — badge-ul a fost scos de pe anunțurile tale.`,
      link: "/upgrade",
      actor_name: "VerifiCasa",
      read: false,
    });
  } catch (_) { /* best-effort */ }

  const user = await getUserById(base44, userId);
  if (!user?.email) return;
  await sendVC(base44, {
    to: user.email,
    subject: reason === "unpaid" ? "VerifiCasa — plata abonamentului a eșuat" : "VerifiCasa — abonamentul s-a anulat",
    content: {
      category: reason === "unpaid" ? "subscription_unpaid" : "subscription_cancelled",
      title: reason === "unpaid" ? "Plata nu a trecut" : "Abonamentul s-a anulat",
      greeting: "Salut!",
      intro: reason === "unpaid"
        ? `Ultima plată pentru ${planLabel} nu a putut fi procesată. Abonamentul și badge-ul de pe anunțurile tale s-au dezactivat până la o nouă plată reușită.`
        : `Abonamentul ${planLabel} s-a încheiat. Badge-ul și beneficiile asociate au fost scoase de pe anunțurile tale.`,
      dataFields: [{ icon: "📋", label: "Plan", value: planLabel }],
      ctaLink: `${APP_URL}/upgrade`,
      ctaLabel: "Reactivează planul",
      closingNote: "Dacă a fost o greșeală sau vrei să continui, poți relua abonamentul oricând din Planuri.",
    },
  });
}

export default async function (req: Request): Promise<Response> {
  try {
    const webhookSecret = secrets.get("StripeWebhookSecret");
    if (!webhookSecret) return Response.json({ error: "Webhook-ul nu e configurat — lipsește StripeWebhookSecret." });

    const sig = req.headers.get("stripe-signature") || "";
    const payload = await req.text();
    const valid = await verifyStripeSignature(payload, sig, webhookSecret);
    if (!valid) return new Response("Invalid signature", { status: 400 });

    const event: any = JSON.parse(payload);
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const obj = event?.data?.object || {};

    if (event.type === "invoice.paid") {
      const stripeSubId = obj.subscription || obj.parent?.subscription_details?.subscription || null;
      if (!stripeSubId) return Response.json({ ok: true, skipped: "no_subscription" });

      const rows = await svc.entities.Subscription.filter({ stripe_subscription_id: stripeSubId }, "-created_date", 1);
      const sub = rows?.[0];
      if (!sub) return Response.json({ ok: true, skipped: "unknown_subscription" });

      const periodEndUnix = obj.period_end ?? obj.lines?.data?.[0]?.period?.end ?? null;
      const patch: any = { status: "active" };
      if (periodEndUnix) patch.current_period_end = new Date(periodEndUnix * 1000).toISOString();
      await svc.entities.Subscription.update(sub.id, patch);

      // Reactivare: dacă badge-ul dispăruse (plată anterioară eșuată/anulată),
      // reînnoirea reușită îl pune la loc.
      if (sub.status !== "active") {
        await stampPosterPlan(svc, sub.user_id, sub.plan_id);
      }

      // Reînnoire REALĂ (nu prima factură a abonamentului, care trece deja
      // prin VerifyCheckoutSession) — recreditează boost-urile incluse în plan.
      // Idempotent pe id-ul facturii Stripe, ca un retry de webhook să nu
      // crediteze de două ori.
      const billingReason = obj.billing_reason || "";
      if (billingReason === "subscription_cycle" && obj.id) {
        const already = await svc.entities.BoostCredit.filter({ source_id: obj.id }, "-created_date", 1);
        if (!already.length) {
          const ent = getEntitlements(sub.plan_id);
          if (ent?.boostsIncluded) {
            await addCredits(svc, {
              userId: sub.user_id, delta: ent.boostsIncluded, reason: "plan_grant",
              sourceId: obj.id, note: `Reînnoire ${sub.plan_id}`,
            });
          }
        }
      }

      return Response.json({ ok: true, event: "invoice.paid" });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const stripeSubId = obj.id;
      if (!stripeSubId) return Response.json({ ok: true, skipped: "no_subscription_id" });

      const rows = await svc.entities.Subscription.filter({ stripe_subscription_id: stripeSubId }, "-created_date", 1);
      const sub = rows?.[0];
      if (!sub) return Response.json({ ok: true, skipped: "unknown_subscription" });

      const stripeStatus = event.type === "customer.subscription.deleted" ? "canceled" : String(obj.status || "");
      const mapped = STATUS_MAP[stripeStatus] || null;
      if (!mapped || mapped === "active") {
        // Statusuri intermediare (ex: incomplete) — nu atingem badge-ul.
        return Response.json({ ok: true, skipped: `status_${stripeStatus}` });
      }
      if (sub.status === mapped) {
        // Deja procesat (Stripe retrimite evenimente) — idempotent.
        return Response.json({ ok: true, already_processed: true });
      }

      await svc.entities.Subscription.update(sub.id, { status: mapped });
      await stampPosterPlan(svc, sub.user_id, null);

      const planLabel = { basic: "VerifiCasa Basic", pro: "VerifiCasa Pro", agent: "VerifiCasa Agent" }[sub.plan_id] || sub.plan_id;
      await notifyLostPlan(base44, sub.user_id, planLabel, mapped === "expired" ? "unpaid" : "cancelled");

      return Response.json({ ok: true, event: event.type, status: mapped });
    }

    return Response.json({ ok: true, skipped: "unhandled_event_type" });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}
