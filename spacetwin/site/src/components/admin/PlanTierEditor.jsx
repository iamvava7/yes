import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save } from "lucide-react";

const FLAGS = [
  ["feat_verification_badge", "Verificare inclusă + badge"],
  ["feat_priority_search", "Poziționare prioritară în căutare"],
  ["feat_dedicated_space", "Spațiu dedicat în listări"],
  ["feat_badge_pro", "Badge Pro pe anunțuri"],
  ["feat_badge_verified_pro", "Badge „Verificat Pro”"],
  ["feat_verified_badge", "Badge „Verificat” pe anunț"],
  ["feat_advanced_stats", "Statistici avansate"],
  ["feat_priority_support", "Suport prioritar"],
  ["feat_email_support", "Suport prin email"],
  ["feat_search_visibility", "Vizibilitate în căutare"],
  ["feat_agency_panel", "Panou dedicat de agenție"],
  ["tours_soon", "Tururi 3D — etichetă «în curând»"],
  ["agency_panel_soon", "Panou agenție — etichetă «în curând»"],
];

const NumField = ({ label, value, onChange, disabled, step = 1 }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
    <input
      type="number" min="0" step={step} value={value ?? ""} disabled={disabled}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      className="w-full rounded border border-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald disabled:opacity-60 dark:bg-card"
    />
  </label>
);

// Un card editabil per plan (Free/Basic/Pro/Agent). Salvarea trece prin
// funcția AdminUpdatePlanConfig, care rotește prețurile în Stripe.
export default function PlanTierEditor({ canEdit }) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);

  const load = async () => {
    try {
      const rows = await base44.entities.PlanConfig.list("-updated_date", 10);
      const order = { none: 0, basic: 1, pro: 2, agent: 3 };
      rows.sort((a, b) => (order[a.plan_id] ?? 9) - (order[b.plan_id] ?? 9));
      setConfigs(rows);
      setDrafts(Object.fromEntries(rows.map((r) => [r.plan_id, { ...r }])));
    } catch { setConfigs([]); }
  };
  useEffect(() => { load(); }, []);

  const set = (planId, field, value) =>
    setDrafts((d) => ({ ...d, [planId]: { ...d[planId], [field]: value } }));

  const save = async (planId) => {
    setSaving(planId);
    try {
      const d = drafts[planId];
      const res = await base44.functions.invoke("AdminUpdatePlanConfig", {
        plan_id: planId,
        monthly_ron: d.monthly_ron, yearly_ron: d.yearly_ron,
        active_listings: d.active_listings, tours_3d: d.tours_3d,
        boosts_included: d.boosts_included, verifications: d.verifications,
        custom_tag: d.custom_tag || "",
        ...Object.fromEntries(FLAGS.map(([k]) => [k, !!d[k]])),
      });
      if (res?.data?.ok) {
        toast({ title: "Plan salvat", description: (res.data.stripe || []).join(" · ") || "Fără modificări Stripe." });
        load();
      } else {
        toast({ title: "Eroare la salvare", description: res?.data?.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Eroare la salvare", description: e?.message, variant: "destructive" });
    } finally { setSaving(null); }
  };

  if (configs === null) return <p className="text-sm text-muted-foreground">Se încarcă planurile…</p>;
  if (!configs.length) return <p className="text-sm text-muted-foreground">Nicio configurare de plan. Configurarea se creează automat la prima rulare.</p>;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {configs.map((c) => {
        const d = drafts[c.plan_id] || c;
        const free = c.plan_id === "none";
        return (
          <div key={c.plan_id} className="rounded border border-border bg-white p-4 dark:bg-card">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-heading font-bold text-navy dark:text-foreground">{c.name || c.plan_id}</p>
                {c.stripe_product_id && (
                  <p className="text-[10px] font-mono text-muted-foreground">{c.stripe_product_id}</p>
                )}
              </div>
              <Button size="sm" onClick={() => save(c.plan_id)} disabled={!canEdit || saving === c.plan_id} className="gap-1.5 bg-emerald text-white">
                {saving === c.plan_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvează
              </Button>
            </div>

            {!free && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <NumField label="Preț lunar (RON)" step={0.01} value={d.monthly_ron} onChange={(v) => set(c.plan_id, "monthly_ron", v)} disabled={!canEdit} />
                <NumField label="Preț anual (RON)" step={0.01} value={d.yearly_ron} onChange={(v) => set(c.plan_id, "yearly_ron", v)} disabled={!canEdit} />
              </div>
            )}

            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <NumField label="Anunțuri active" value={d.active_listings} onChange={(v) => set(c.plan_id, "active_listings", v)} disabled={!canEdit} />
              <NumField label="Tururi 3D" value={d.tours_3d} onChange={(v) => set(c.plan_id, "tours_3d", v)} disabled={!canEdit} />
              <NumField label="Boost-uri incluse" value={d.boosts_included} onChange={(v) => set(c.plan_id, "boosts_included", v)} disabled={!canEdit} />
              <NumField label="Verificări" value={d.verifications} onChange={(v) => set(c.plan_id, "verifications", v)} disabled={!canEdit} />
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Etichetă custom (ex: Popular, Economisești 20%)</span>
              <input
                value={d.custom_tag || ""} disabled={!canEdit}
                onChange={(e) => set(c.plan_id, "custom_tag", e.target.value)}
                className="w-full rounded border border-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald disabled:opacity-60 dark:bg-card"
              />
            </label>

            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {FLAGS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-foreground/80">
                  <input
                    type="checkbox" checked={!!d[key]} disabled={!canEdit}
                    onChange={(e) => set(c.plan_id, key, e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#1F7048]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}