import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RotateCcw, Save, Search } from "lucide-react";
import { STR } from "@/i18n";

// Admin → „Texte site". Orice text din dicționarul aplicației (src/i18n.js)
// se poate schimba de aici, în română și în engleză, fără cod și fără
// publicare: CountryContext citește textele salvate (SiteText) și le aplică
// imediat, pentru toți vizitatorii. „Revino la original" șterge modificarea.
//
// Textele scrise direct în pagini (de ex. pagina Tur 3D, cu obiectul ei
// CONTENT) nu apar aici; ele se schimbă în cod.
const PAGE = 40;

export default function SiteTextEditor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState(null); // SiteText din baza de date
  const [query, setQuery] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(null);
  const [limit, setLimit] = useState(PAGE);

  const load = async () => {
    try { setRows(await base44.entities.SiteText.list("-updated_date", 1000)); } catch { setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const saved = useMemo(() => Object.fromEntries((rows || []).map((r) => [r.key, r])), [rows]);
  const keys = useMemo(() => Object.keys(STR.ro), []);
  const q = query.trim().toLowerCase();
  const matches = keys.filter((k) => {
    if (onlyChanged && !saved[k]) return false;
    if (!q) return true;
    const o = saved[k];
    return [k, STR.ro[k], STR.en?.[k], o?.ro, o?.en].some((v) => typeof v === "string" && v.toLowerCase().includes(q));
  });

  const draftOf = (k) => drafts[k] ?? { ro: saved[k]?.ro ?? "", en: saved[k]?.en ?? "" };
  const setDraft = (k, lang, v) => setDrafts((d) => ({ ...d, [k]: { ...draftOf(k), [lang]: v } }));

  const save = async (k) => {
    const d = draftOf(k);
    setBusy(k);
    try {
      const data = { key: k, ro: d.ro.trim(), en: d.en.trim(), updated_by_name: user?.full_name || user?.email || "" };
      if (!data.ro && !data.en) {
        if (saved[k]) await base44.entities.SiteText.delete(saved[k].id);
      } else if (saved[k]) {
        await base44.entities.SiteText.update(saved[k].id, data);
      } else {
        await base44.entities.SiteText.create(data);
      }
      toast({ title: "Text salvat", description: "E deja live pe site." });
      setDrafts((x) => { const n = { ...x }; delete n[k]; return n; });
      load();
    } catch (e) {
      toast({ title: "Nu s-a putut salva", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const reset = async (k) => {
    if (!saved[k]) return;
    setBusy(k);
    try {
      await base44.entities.SiteText.delete(saved[k].id);
      toast({ title: "Revenit la textul original" });
      setDrafts((x) => { const n = { ...x }; delete n[k]; return n; });
      load();
    } catch (e) {
      toast({ title: "Eroare", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  if (rows === null) return <p className="text-sm text-muted-foreground">Se încarcă textele…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
            placeholder="Caută un text de pe site (ex. „Caută chirii”) sau o cheie"
            className="h-9 w-full rounded border border-input bg-background pl-8 pr-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} /> Doar cele modificate ({rows.length})
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{matches.length} texte · schimbările apar imediat pe site, pentru toți vizitatorii. Păstrează parantezele de forma {"{nume}"}: acolo apar valori.</p>

      <div className="divide-y divide-border rounded border border-border bg-white dark:bg-card">
        {matches.slice(0, limit).map((k) => {
          const d = draftOf(k);
          const dirty = d.ro !== (saved[k]?.ro ?? "") || d.en !== (saved[k]?.en ?? "");
          return (
            <div key={k} className="grid gap-2 p-3 lg:grid-cols-[180px_1fr_1fr_auto] lg:items-start">
              <div className="min-w-0">
                <code className="break-all font-mono text-[11px] text-muted-foreground">{k}</code>
                {saved[k] && <span className="ml-1 rounded bg-emerald-soft px-1.5 py-0.5 text-[10px] font-semibold text-emerald">modificat</span>}
              </div>
              {["ro", "en"].map((lang) => (
                <label key={lang} className="block">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{lang} · original: <span className="normal-case tracking-normal">{(STR[lang]?.[k] ?? STR.ro[k]) || "—"}</span></span>
                  <textarea
                    rows={2} value={d[lang]} placeholder={(STR[lang]?.[k] ?? STR.ro[k]) || ""}
                    onChange={(e) => setDraft(k, lang, e.target.value)}
                    className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-sm"
                    aria-label={`${k} (${lang})`}
                  />
                </label>
              ))}
              <div className="flex gap-1.5 lg:flex-col">
                <Button size="sm" className="h-8 gap-1 bg-emerald text-xs text-white" disabled={!dirty || busy === k} onClick={() => save(k)}>
                  {busy === k ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvează
                </Button>
                {saved[k] && (
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" disabled={busy === k} onClick={() => reset(k)}>
                    <RotateCcw className="h-3 w-3" /> Original
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {matches.length > limit && (
        <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>Arată încă {Math.min(PAGE, matches.length - limit)}</Button>
      )}
    </div>
  );
}
