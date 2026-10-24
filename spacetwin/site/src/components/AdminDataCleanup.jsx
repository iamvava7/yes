import React, { useState } from "react";
import { Loader2, Trash2, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

// Panoul de curățare a datelor demo. Rulează întâi o simulare și arată exact
// ce urmează să se schimbe; abia apoi permite scrierea. Nimic nu se scrie
// până când cineva nu vede lista și nu apasă a doua oară.
export default function AdminDataCleanup({ onDone }) {
  const { toast } = useToast();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  const call = async (dryRun) => {
    const res = await base44.functions.invoke("CleanDemoData", {
      dry_run: dryRun,
      // promovează un anunț real, ca insigna „Promovat" să existe în aplicație
      boost_demo: true,
    });
    return res?.data || res || {};
  };

  const runPreview = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await call(true);
      if (data.error) {
        toast({ title: "Nu am putut citi datele", description: data.error, variant: "destructive" });
      } else {
        setPreview(data);
      }
    } catch (e) {
      toast({ title: "Nu am putut citi datele", description: "Încearcă din nou.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const data = await call(false);
      if (data.error) {
        toast({ title: "Curățarea a eșuat", description: data.error, variant: "destructive" });
      } else {
        setResult(data);
        setPreview(null);
        toast({
          title: "Date curățate",
          description: `${data.deleted} șterse, ${data.updated} corectate.`,
        });
        onDone?.();
      }
    } catch (e) {
      toast({ title: "Curățarea a eșuat", description: "Încearcă din nou.", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-bold text-foreground">Curăță datele demo</h3>
      <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
        Șterge anunțurile de test, readuce prețurile, camerele și suprafețele în intervale
        credibile, înlocuiește fotografiile generate cu cele reale și scoate insigna de
        verificare de pe orice anunț corectat.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={runPreview}
          disabled={loading || applying}
          className="flex min-h-[44px] items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:border-emerald disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          Vezi ce se schimbă
        </button>

        {preview && (preview.delete_count > 0 || preview.update_count > 0) && (
          <button
            type="button"
            onClick={apply}
            disabled={applying}
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-emerald px-5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Aplică pe {preview.delete_count + preview.update_count} anunțuri
          </button>
        )}
      </div>

      {preview && (
        <div className="mt-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">
            {preview.scanned} anunțuri verificate · {preview.delete_count} de șters ·{" "}
            {preview.update_count} de corectat
          </p>

          {preview.delete_count === 0 && preview.update_count === 0 && (
            <p className="text-sm text-muted-foreground">Datele sunt deja curate. Nu e nimic de făcut.</p>
          )}

          {preview.will_delete?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-destructive">Se șterg</p>
              <ul className="space-y-1">
                {preview.will_delete.map((d) => (
                  <li key={d.id} className="text-sm text-muted-foreground">
                    „{d.title}" — {d.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.will_update?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Se corectează</p>
              <ul className="no-scrollbar max-h-64 space-y-1.5 overflow-y-auto pr-2 sm:max-h-80">
                {preview.will_update.map((u) => (
                  <li key={u.id} className="text-sm">
                    <span className="font-semibold text-foreground">{u.title || "(fără titlu)"}</span>
                    <span className="text-muted-foreground"> — {u.reasons.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-1">
          <p className="text-sm font-semibold text-emerald">
            Gata: {result.deleted} șterse, {result.updated} corectate din {result.scanned} verificate.
          </p>
          {result.boosted?.title && (
            <p className="text-sm text-muted-foreground">
              Anunț promovat pentru demonstrație: „{result.boosted.title}"
              {result.boosted.note ? ` (${result.boosted.note})` : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
