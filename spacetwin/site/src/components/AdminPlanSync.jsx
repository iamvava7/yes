import React, { useState } from "react";
import { Loader2, RefreshCw, Gift } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

// Rulează SyncPosterPlans.
//
// Funcția exista de la blocarea RLS pe Subscription, dar NU o chema nimeni —
// `grep -rn SyncPosterPlans src/` nu găsea niciun apel. Fără ea, Property.
// poster_plan rămâne nescris pe tot ce nu a trecut printr-o plată Stripe, iar
// planul unui anunț nu se poate afla din browser: Subscription.read e limitat
// la propriul rând, deci un vizitator vede planul DOAR pentru propriile
// anunțuri. De aceea rândul „Agent" de pe prima pagină arăta gol pentru toată
// lumea în afară de agentul însuși.
//
// Anunțurile noi se ștampilează singure la publicare (vezi PropertyWizard).
// Butonul ăsta e pentru tot ce există deja și pentru abonamentele acordate de
// mână din panoul Base44, care nu trec prin VerifyCheckoutSession.
// Câte anunțuri de fiecare plan în datele de demonstrație. E forma pe care o
// avea aplicația înainte ca cineva să șteargă suprascrierile din panoul Base44:
// 5 Agent, 4 Pro, 12 Basic. Restul rămân fără plan.
const DEMO_SPREAD = { agent: 5, pro: 4, basic: 12 };

export default function AdminPlanSync() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(null);

  // Acordă un plan manual, fără Stripe (cererea clientului, 23.08): activează
  // abonamentul, acordă boost-urile incluse și pune badge-ul pe anunțuri — tot
  // ce face o plată reală, dintr-un singur buton, în loc de editare directă pe
  // tabelă (care sărea peste boost-uri și badge).
  const [grantEmail, setGrantEmail] = useState("");
  const [grantPlan, setGrantPlan] = useState("basic");
  const [grantInterval, setGrantInterval] = useState("monthly");
  const [granting, setGranting] = useState(false);

  const grantPlanNow = async () => {
    if (!grantEmail.trim()) {
      toast({ title: "Introdu emailul utilizatorului", variant: "destructive" });
      return;
    }
    setGranting(true);
    try {
      const res = await base44.functions.invoke("AdminGrantPlan", {
        email: grantEmail.trim(),
        plan_id: grantPlan,
        billing_interval: grantInterval,
      });
      const data = res?.data || res || {};
      if (data.error) {
        toast({ title: "Nu am putut acorda planul", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: "Plan acordat",
          description: `${data.user_email} are acum planul ${grantPlan}, valabil până la ${new Date(data.current_period_end).toLocaleDateString("ro-RO")}.`,
        });
        setGrantEmail("");
      }
    } catch (e) {
      toast({ title: "Nu am putut acorda planul", description: "Încearcă din nou.", variant: "destructive" });
    } finally {
      setGranting(false);
    }
  };

  // Pune la loc planurile de demonstrație pe anunțuri.
  //
  // `poster_plan_override` bate `poster_plan` în resolvePropertyPlan, deci
  // câmpul ăsta — nu abonamentele — e cel care umple rândurile Agent și Pro de
  // pe prima pagină cât timp nu există abonați adevărați. Nimic din aplicație
  // nu îl scria: se punea de mână din panou, și tot de mână a fost șters.
  //
  // Alegerea e deterministă, nu la întâmplare: anunțurile se ordonează după id,
  // iar cele care se declară „Agent" primesc primele planul Agent — un anunț
  // de agenție pe planul de agenție se citește coerent. Rulat de două ori dă
  // același rezultat.
  const seedDemoPlans = async () => {
    setSeeding(true);
    setSeeded(null);
    try {
      const all = await base44.entities.Property.filter(
        { approval_status: "APPROVED", country: "RO" }, "-created_date", 200
      );
      const sorted = [...(all || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const agentsFirst = [
        ...sorted.filter((p) => p.seller_role === "Agent"),
        ...sorted.filter((p) => p.seller_role !== "Agent"),
      ];

      const plan = new Map();
      let i = 0;
      for (const [id, n] of Object.entries(DEMO_SPREAD)) {
        for (let k = 0; k < n && i < agentsFirst.length; k += 1, i += 1) {
          plan.set(agentsFirst[i].id, id);
        }
      }

      // Fiecare anunț pe cont propriu. Câmpul are enum (basic|pro|agent), iar
      // golirea lui e singura scriere care poate fi refuzată — dacă platforma
      // nu acceptă null pe un enum, se încearcă șirul gol. Un refuz pe un
      // singur anunț nu are voie să oprească tot lotul: până acum o singură
      // eroare arunca din buclă și restul rămâneau neatinse, fără să se vadă
      // câte apucaseră să se scrie.
      let changed = 0;
      let failed = 0;
      for (const prop of sorted) {
        const want = plan.get(prop.id) || null;
        const have = prop.poster_plan_override || null;
        if (want === have) continue;
        try {
          await base44.entities.Property.update(prop.id, { poster_plan_override: want });
          changed += 1;
        } catch (_) {
          try {
            await base44.entities.Property.update(prop.id, { poster_plan_override: want || "" });
            changed += 1;
          } catch (_e) {
            failed += 1;
          }
        }
      }

      setSeeded({ changed, failed, total: sorted.length, ...DEMO_SPREAD });
      toast({
        title: failed ? "Planuri demo aplicate parțial" : "Planuri demo aplicate",
        description: `${changed} anunțuri modificate — ${DEMO_SPREAD.agent} Agent, ${DEMO_SPREAD.pro} Pro, ${DEMO_SPREAD.basic} Basic.`
          + (failed ? ` ${failed} refuzate.` : ""),
        variant: failed ? "destructive" : undefined,
      });
    } catch (e) {
      toast({
        title: "Nu am putut aplica planurile demo",
        description: e?.message || "Încearcă din nou.",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  };

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("SyncPosterPlans", {});
      const data = res?.data || res || {};
      if (data.error) {
        toast({ title: "Sincronizarea a eșuat", description: data.error, variant: "destructive" });
      } else {
        setResult(data);
        toast({
          title: "Planuri sincronizate",
          description: `${data.updated} anunțuri actualizate din ${data.properties} verificate.`,
        });
      }
    } catch (e) {
      toast({ title: "Sincronizarea a eșuat", description: "Încearcă din nou.", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="rounded border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-emerald" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-bold text-foreground">Acordă un plan manual</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Fără plată Stripe. Activează abonamentul, acordă boost-urile incluse și pune badge-ul pe
            anunțurile omului, imediat — aceleași efecte ca o plată reală.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="email"
          value={grantEmail}
          onChange={(e) => setGrantEmail(e.target.value)}
          placeholder="email@utilizator.ro"
          className="min-h-[44px] rounded-xl border border-border bg-background px-3.5 text-base text-foreground outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/15"
        />
        <select
          value={grantPlan}
          onChange={(e) => setGrantPlan(e.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-background px-3.5 text-base text-foreground"
        >
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="agent">Agent</option>
        </select>
        <select
          value={grantInterval}
          onChange={(e) => setGrantInterval(e.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-background px-3.5 text-base text-foreground"
        >
          <option value="monthly">Lunar</option>
          <option value="yearly">Anual</option>
        </select>
        <button
          type="button"
          onClick={grantPlanNow}
          disabled={granting}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-emerald px-5 font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {granting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {granting ? "Se acordă…" : "Acordă"}
        </button>
      </div>

      <div className="mt-6 border-t border-border pt-5">
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-emerald" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-bold text-foreground">Sincronizează planurile pe anunțuri</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Scrie planul fiecărui proprietar pe anunțurile lui, ca insigna și rândurile pe plan
            de pe prima pagină să se vadă pentru toată lumea, nu doar pentru proprietar. Nu mai e
            necesar după un plan acordat cu butonul de mai sus — acela stampilează singur.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={running}
        className="mt-4 flex min-h-[44px] items-center gap-2 rounded-full bg-emerald px-5 font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {running && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {running ? "Se sincronizează…" : "Rulează sincronizarea"}
      </button>

      {result && (
        <p className="mt-3 text-sm text-muted-foreground">
          {result.updated} actualizate din {result.properties} anunțuri, pe baza a{" "}
          {result.subscriptions} abonamente active
          {result.failed ? ` · ${result.failed} eșuate` : ""}.
        </p>
      )}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="font-heading text-base font-bold text-foreground">Planuri pe datele de demonstrație</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Pune la loc {DEMO_SPREAD.agent} Agent, {DEMO_SPREAD.pro} Pro și {DEMO_SPREAD.basic} Basic pe anunțurile
          existente, ca rândurile Agent și Pro de pe prima pagină să aibă ce arăta cât timp nu există
          abonați adevărați. Scrie `poster_plan_override`, care bate planul real. Rulat de două ori dă
          același rezultat.
        </p>
        <button
          type="button"
          onClick={seedDemoPlans}
          disabled={seeding}
          className="mt-3 flex min-h-[44px] items-center gap-2 rounded-full border border-border px-5 font-bold text-foreground transition-colors hover:border-emerald disabled:opacity-50"
        >
          {seeding && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {seeding ? "Se aplică…" : "Aplică planurile demo"}
        </button>
        {seeded && (
          <p className="mt-3 text-sm text-muted-foreground">
            {seeded.changed} anunțuri modificate din {seeded.total}
            {seeded.failed ? ` · ${seeded.failed} refuzate` : ""}.
          </p>
        )}
      </div>
    </section>
  );
}
