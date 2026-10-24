import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { PLANS, FREE_PLAN, BOOST_PACKS } from "@/lib/plans";

// Planurile și pachetele de boost DINAMICE: configurarea din Admin → Planuri &
// Prețuri (PlanConfig / BoostPackConfig) se suprapune peste valorile statice
// din src/lib/plans.js. Cu abonare realtime — o salvare din admin se vede
// instant pe /upgrade, fără refresh.
const F = (ro, en, soon = false) => ({ ro, en, soon });

function buildRows(c) {
  const n = Number(c.active_listings);
  const headline = [];
  if (Number.isFinite(n) && n > 0) {
    headline.push(n === 1 ? F("1 anunț activ", "1 active listing") : F(`${n} x anunțuri active`, `${n} x active listings`));
  }
  if (Number(c.tours_3d) > 0) headline.push(F(`${c.tours_3d} x tururi 3D`, `${c.tours_3d} x 3D tours`, !!c.tours_soon));
  if (Number(c.boosts_included) > 0) headline.push(F(`${c.boosts_included} x boost-uri`, `${c.boosts_included} x boosts`));
  if (c.feat_verification_badge) headline.push(F("1 verificare inclusă + badge pe anunțuri", "1 verification included + badge on listings"));
  if (c.feat_priority_search) headline.push(F("Poziționare prioritară în căutare", "Priority placement in search"));
  if (c.feat_dedicated_space) headline.push(F("Spațiu dedicat în listări", "Specific listing space"));
  if (c.feat_badge_pro) headline.push(F("Badge Pro pe anunțuri", "Pro badge on listings"));
  if (c.feat_agency_panel) headline.push(F("Panou dedicat de agenție", "Dedicated agency panel", !!c.agency_panel_soon));

  const includes = [];
  if (c.feat_badge_verified_pro) includes.push(F("Badge „Verificat Pro”", "Verified Pro badge"));
  if (c.feat_advanced_stats) includes.push(F("Statistici avansate ale anunțului", "Advanced listing stats"));
  if (c.feat_priority_support) includes.push(F("Suport prioritar", "Priority support"));
  if (c.feat_email_support) includes.push(F("Suport prin email", "Email support"));
  if (c.feat_search_visibility) includes.push(F("Vizibilitate în căutare", "Search visibility"));
  if (c.feat_verified_badge) includes.push(F("Badge „Verificat” pe anunț", "Verified badge on listing"));
  return { headline, includes };
}

function mergePlan(staticPlan, c) {
  if (!c) return staticPlan;
  const { headline, includes } = buildRows(c);
  return {
    ...staticPlan,
    monthly: Number.isFinite(Number(c.monthly_ron)) && c.monthly_ron !== null ? Number(c.monthly_ron) : staticPlan.monthly,
    yearly: Number.isFinite(Number(c.yearly_ron)) && c.yearly_ron !== null ? Number(c.yearly_ron) : staticPlan.yearly,
    description: c.description || staticPlan.description,
    description_en: c.description_en || staticPlan.description_en,
    tours3d: Number(c.tours_3d) || 0,
    boostsIncluded: Number(c.boosts_included) || 0,
    tag: c.custom_tag || null,
    headline: headline.length ? headline : staticPlan.headline,
    includes: includes.length ? includes : staticPlan.includes,
  };
}

export function usePlanConfigs() {
  const qc = useQueryClient();
  const { data: configs } = useQuery({
    queryKey: ["planConfigs"],
    queryFn: () => base44.entities.PlanConfig.list("-updated_date", 10),
    staleTime: 30000,
  });
  const { data: packs } = useQuery({
    queryKey: ["boostPackConfigs"],
    queryFn: () => base44.entities.BoostPackConfig.list("sort_order", 20),
    staleTime: 30000,
  });

  // realtime: orice salvare din admin invalidează cache-ul — pagina se
  // actualizează pe loc, fără redeploy sau refresh manual.
  useEffect(() => {
    const unsubs = [];
    try { unsubs.push(base44.entities.PlanConfig.subscribe(() => qc.invalidateQueries({ queryKey: ["planConfigs"] }))); } catch { /* noop */ }
    try { unsubs.push(base44.entities.BoostPackConfig.subscribe(() => qc.invalidateQueries({ queryKey: ["boostPackConfigs"] }))); } catch { /* noop */ }
    return () => unsubs.forEach((u) => { try { u && u(); } catch { /* noop */ } });
  }, [qc]);

  const byId = new Map((configs || []).map((c) => [c.plan_id, c]));
  const plans = PLANS.map((p) => mergePlan(p, byId.get(p.id)));
  const freePlan = mergePlan(FREE_PLAN, byId.get("none"));

  const activePacks = (packs || []).filter((p) => p.active !== false);
  const boostPacks = activePacks.length
    ? activePacks
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((p) => ({ id: p.pack_id, boosts: p.boosts, priceRon: p.price_ron, popular: !!p.popular, single: !!p.single }))
    : BOOST_PACKS;

  return { plans, freePlan, boostPacks };
}