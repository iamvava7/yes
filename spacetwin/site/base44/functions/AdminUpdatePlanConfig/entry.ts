import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getStripeKey, stripeCall } from "../../shared/stripeKey.js";

// Editorul de planuri din Admin → Planuri & Prețuri. Doar SUPER_ADMIN (sau
// proprietarul aplicației, rolul built-in "admin") poate modifica.
//
// SINCRONIZARE STRIPE: prețurile Stripe sunt imuabile — la schimbarea unui preț
// se CREEAZĂ un Price nou sub același Product, devine default (pentru lunar),
// iar cel vechi se dezactivează. CreateCheckoutSession citește Price ID-urile
// din PlanConfig, deci plata folosește instant prețul nou, fără redeploy.
const NUM_FIELDS = ["monthly_ron", "yearly_ron", "active_listings", "tours_3d", "boosts_included", "verifications"];
const BOOL_FIELDS = [
  "feat_verification_badge", "feat_priority_search", "feat_dedicated_space", "feat_badge_pro",
  "feat_agency_panel", "feat_email_support", "feat_search_visibility", "feat_verified_badge",
  "feat_badge_verified_pro", "feat_advanced_stats", "feat_priority_support", "tours_soon", "agency_panel_soon",
];
const TEXT_FIELDS = ["name", "description", "description_en", "custom_tag"];

function buildFeatures(c: any): string[] {
  const f: string[] = [];
  if (c.active_listings) f.push(`${c.active_listings} x anunțuri active`);
  if (c.tours_3d) f.push(`${c.tours_3d} x tururi 3D${c.tours_soon ? " (în curând)" : ""}`);
  if (c.boosts_included) f.push(`${c.boosts_included} x boost-uri`);
  if (c.feat_verification_badge) f.push("1 verificare inclusă + badge pe anunțuri");
  if (c.feat_priority_search) f.push("Poziționare prioritară în căutare");
  if (c.feat_dedicated_space) f.push("Spațiu dedicat în listări");
  if (c.feat_badge_pro) f.push("Badge Pro pe anunțuri");
  if (c.feat_badge_verified_pro) f.push("Badge „Verificat Pro”");
  if (c.feat_advanced_stats) f.push("Statistici avansate ale anunțului");
  if (c.feat_priority_support) f.push("Suport prioritar");
  if (c.feat_email_support) f.push("Suport prin email");
  if (c.feat_search_visibility) f.push("Vizibilitate în căutare");
  if (c.feat_verified_badge) f.push("Badge „Verificat” pe anunț");
  if (c.feat_agency_panel) f.push(`Panou dedicat de agenție${c.agency_panel_soon ? " (în curând)" : ""}`);
  return f.slice(0, 15); // Stripe acceptă max 15 marketing features
}

async function rotatePrice(secretKey: string, productId: string, cfg: any, patch: any, kind: "monthly" | "yearly") {
  const field = kind === "monthly" ? "monthly_ron" : "yearly_ron";
  const idField = kind === "monthly" ? "stripe_price_monthly_id" : "stripe_price_yearly_id";
  if (patch[field] === undefined || Number(patch[field]) === Number(cfg[field])) return null;
  const p = new URLSearchParams();
  p.set("product", productId);
  p.set("currency", "ron");
  p.set("unit_amount", String(Math.round(Number(patch[field]) * 100)));
  p.set("recurring[interval]", kind === "monthly" ? "month" : "year");
  p.set("nickname", `${cfg.name || cfg.plan_id} ${kind === "monthly" ? "lunar" : "anual"}`);
  const np = await stripeCall(secretKey, "POST", "prices", p);
  // Lunar devine default-ul produsului ÎNAINTE de a stinge prețul vechi —
  // Stripe refuză dezactivarea unui preț cât timp e default.
  if (kind === "monthly") {
    try {
      const dp = new URLSearchParams();
      dp.set("default_price", np.id);
      await stripeCall(secretKey, "POST", `products/${productId}`, dp);
    } catch (_) { /* best-effort */ }
  }
  if (cfg[idField]) {
    try {
      const off = new URLSearchParams();
      off.set("active", "false");
      await stripeCall(secretKey, "POST", `prices/${cfg[idField]}`, off);
    } catch (_) { /* best-effort — prețul vechi rămâne activ, dar nefolosit */ }
  }
  patch[idField] = np.id;
  return np.id;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });
    const roleUp = (me.role || "").toUpperCase();
    const canEdit = roleUp === "SUPER_ADMIN" || me.role === "admin";
    if (!canEdit) return Response.json({ error: "Doar SUPER_ADMIN poate modifica planurile și prețurile." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const planId = body?.plan_id;
    if (!planId) return Response.json({ error: "plan_id lipsă." });

    const svc = base44.asServiceRole;
    const rows = await svc.entities.PlanConfig.filter({ plan_id: planId }, "-updated_date", 1);
    const cfg: any = rows?.[0];
    if (!cfg) return Response.json({ error: "Planul nu există în configurare. Rulează seed-ul din admin." });

    const patch: any = {};
    for (const f of NUM_FIELDS) {
      if (body[f] !== undefined && body[f] !== null && body[f] !== "") patch[f] = Number(body[f]);
    }
    for (const f of BOOL_FIELDS) if (body[f] !== undefined) patch[f] = !!body[f];
    for (const f of TEXT_FIELDS) if (body[f] !== undefined) patch[f] = String(body[f] ?? "");

    const stripeActions: string[] = [];
    const secretKey = getStripeKey(secrets);
    const productId = cfg.stripe_product_id;

    if (secretKey && productId) {
      const newMonthly = await rotatePrice(secretKey, productId, cfg, patch, "monthly");
      if (newMonthly) stripeActions.push(`Preț lunar nou în Stripe: ${newMonthly}`);
      const newYearly = await rotatePrice(secretKey, productId, cfg, patch, "yearly");
      if (newYearly) stripeActions.push(`Preț anual nou în Stripe: ${newYearly}`);

      // Descrierea + lista de beneficii de pe produsul Stripe urmează configul.
      try {
        const merged = { ...cfg, ...patch };
        const pp = new URLSearchParams();
        if (merged.description) pp.set("description", merged.description);
        buildFeatures(merged).forEach((f, i) => pp.append(`marketing_features[${i}][name]`, f));
        await stripeCall(secretKey, "POST", `products/${productId}`, pp);
        stripeActions.push("Produs Stripe sincronizat");
      } catch (_) {
        stripeActions.push("Atenție: descrierea produsului Stripe nu s-a putut actualiza");
      }
    } else if ((patch.monthly_ron !== undefined || patch.yearly_ron !== undefined) && !productId) {
      stripeActions.push("Plan fără produs Stripe — prețul s-a salvat doar local");
    }

    if (Object.keys(patch).length) await svc.entities.PlanConfig.update(cfg.id, patch);

    try {
      await svc.entities.AuditLog.create({
        actor_id: me.id, actor_name: me.full_name || me.email, actor_role: roleUp,
        action: "update_plan", target_type: "plan", target_id: planId,
        detail: Object.keys(patch).join(", ").slice(0, 300),
      });
    } catch (_) { /* best-effort */ }

    return Response.json({ ok: true, plan_id: planId, stripe: stripeActions });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}