import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save } from "lucide-react";

// Grila de pachete „Promovează un anunț" (1/3/6/12 boost-uri). Prețul per
// boost se calculează live. Salvarea trece prin AdminUpdateBoostPack;
// checkout-ul citește BoostPackConfig, deci prețul nou e live imediat.
export default function BoostPackEditor({ canEdit }) {
  const { toast } = useToast();
  const [packs, setPacks] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);

  const load = async () => {
    try {
      const rows = await base44.entities.BoostPackConfig.list("sort_order", 20);
      setPacks(rows);
      setDrafts(Object.fromEntries(rows.map((r) => [r.pack_id, { ...r }])));
    } catch { setPacks([]); }
  };
  useEffect(() => { load(); }, []);

  const set = (packId, field, value) =>
    setDrafts((d) => ({ ...d, [packId]: { ...d[packId], [field]: value } }));

  const save = async (packId) => {
    setSaving(packId);
    try {
      const d = drafts[packId];
      const res = await base44.functions.invoke("AdminUpdateBoostPack", {
        pack_id: packId, boosts: d.boosts, price_ron: d.price_ron,
        popular: !!d.popular, active: d.active !== false,
      });
      if (res?.data?.ok) { toast({ title: "Pachet salvat" }); load(); }
      else toast({ title: "Eroare", description: res?.data?.error, variant: "destructive" });
    } catch (e) {
      toast({ title: "Eroare", description: e?.message, variant: "destructive" });
    } finally { setSaving(null); }
  };

  if (packs === null) return <p className="text-sm text-muted-foreground">Se încarcă pachetele…</p>;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {packs.map((p) => {
        const d = drafts[p.pack_id] || p;
        const unit = Number(d.boosts) > 0 ? Number(d.price_ron) / Number(d.boosts) : 0;
        return (
          <div key={p.pack_id} className={"rounded border bg-white p-3 dark:bg-card " + (d.active === false ? "border-border opacity-60" : "border-border")}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-muted-foreground">{p.pack_id}</span>
              <Button size="sm" onClick={() => save(p.pack_id)} disabled={!canEdit || saving === p.pack_id} className="h-7 gap-1 bg-emerald px-2 text-xs text-white">
                {saving === p.pack_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvează
              </Button>
            </div>
            <label className="mb-2 block">
              <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">Boost-uri</span>
              <input type="number" min="1" value={d.boosts ?? ""} disabled={!canEdit}
                onChange={(e) => set(p.pack_id, "boosts", e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald disabled:opacity-60 dark:bg-card" />
            </label>
            <label className="mb-2 block">
              <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">Preț total (RON)</span>
              <input type="number" min="0" step="0.01" value={d.price_ron ?? ""} disabled={!canEdit}
                onChange={(e) => set(p.pack_id, "price_ron", e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald disabled:opacity-60 dark:bg-card" />
            </label>
            <p className="mb-2 text-[11px] font-semibold text-emerald">
              {unit ? `${unit.toFixed(2).replace(".", ",")} RON / boost` : "—"}
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-foreground/80">
                <input type="checkbox" checked={!!d.popular} disabled={!canEdit}
                  onChange={(e) => set(p.pack_id, "popular", e.target.checked)} className="h-3.5 w-3.5 accent-[#1F7048]" />
                Popular
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground/80">
                <input type="checkbox" checked={d.active !== false} disabled={!canEdit}
                  onChange={(e) => set(p.pack_id, "active", e.target.checked)} className="h-3.5 w-3.5 accent-[#1F7048]" />
                Activ
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}