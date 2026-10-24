import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { KeyRound, Loader2, ShieldCheck, Trash2, Plug, Plus, AlertTriangle } from "lucide-react";
import { callFn } from "@/lib/serverCall";

// Admin → „Integrări & chei API": adaugi sau înlocuiești o cheie API, o
// testezi, o ștergi — fără acces la server.
//
// Ce NU face, intenționat: nu afișează niciodată o cheie. Valoarea pleacă o
// singură dată spre backend (AdminIntegrations), unde e criptată cu
// INTEGRATIONS_MASTER_KEY; în browser se întorc doar ultimele 4 caractere.
// Dacă aceeași cheie e setată și pe server (.env), aceea are prioritate.
export default function AdminIntegrations({ canEdit }) {
  const { toast } = useToast();
  const [state, setState] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(null);
  const [newName, setNewName] = useState("");

  const load = async () => {
    const res = await callFn("AdminIntegrations", { action: "list" });
    if (res.ok) setState(res.data);
    else setState({ error: res.error, items: [] });
  };
  useEffect(() => { load(); }, []);

  const run = async (key, payload, okTitle) => {
    setBusy(key);
    const res = await callFn("AdminIntegrations", payload);
    setBusy(null);
    if (!res.ok) {
      toast({ title: "Nu s-a putut", description: res.error, variant: "destructive" });
      return null;
    }
    if (okTitle) toast({ title: okTitle });
    return res.data;
  };

  const save = async (name, label) => {
    const value = (drafts[name] || "").trim();
    if (!value) return;
    if (await run(name, { action: "save", name, value, label }, "Cheie salvată (criptată)")) {
      setDrafts((d) => ({ ...d, [name]: "" }));
      load();
    }
  };

  const remove = async (name) => {
    if (!window.confirm(`Ștergi cheia „${name}" salvată din panou? (Valoarea din .env de pe server, dacă există, rămâne.)`)) return;
    if (await run(name, { action: "delete", name }, "Cheie ștearsă")) load();
  };

  const test = async (name) => {
    const data = await run(`test:${name}`, { action: "test", name });
    if (data) toast({ title: data.ok ? "Funcționează" : "Nu funcționează", description: data.result, variant: data.ok ? undefined : "destructive" });
  };

  const addCustom = () => {
    const name = newName.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(name)) {
      toast({ title: "Nume invalid", description: "Litere, cifre și _, ex. OPENWEATHER_KEY.", variant: "destructive" });
      return;
    }
    setState((s) => ({ ...s, items: s.items.some((i) => i.name === name) ? s.items : [...s.items, { name, label: name, group: "Altele", inPanel: false, inServer: false }] }));
    setNewName("");
  };

  if (state === null) return <p className="text-sm text-muted-foreground">Se încarcă integrările…</p>;
  if (state.error) return <p className="text-sm text-rose-600">Nu am putut încărca integrările: {state.error}</p>;

  const groups = [...new Set(state.items.map((i) => i.group))];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
        <p>
          Cheile se criptează înainte de salvare și nu mai sunt afișate niciodată — vezi doar ultimele 4 caractere.
          Nu se scriu în cod și nu ajung în repository. O cheie setată și în fișierul .env de pe server are prioritate.
        </p>
      </div>

      {!state.masterKeySet && (
        <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Ca să poți salva chei de aici, adaugă o singură dată în fișierul .env de pe server variabila
            <code className="mx-1 rounded bg-white px-1">INTEGRATIONS_MASTER_KEY</code>
            cu o frază lungă și aleatorie (minim 16 caractere), apoi repornește serverul. Fără ea, cheile se pot seta doar în .env.
          </p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g}>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">{g}</h3>
          <div className="divide-y divide-border rounded border border-border bg-white dark:bg-card">
            {state.items.filter((i) => i.group === g).map((i) => (
              <div key={i.name} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 shrink-0 text-emerald" />
                    <span className="truncate text-sm font-semibold text-foreground">{i.label}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-6 text-[11px] text-muted-foreground">
                    <code className="font-mono">{i.name}</code>
                    {i.inServer && <span className="rounded bg-emerald-soft px-1.5 py-0.5 font-semibold text-emerald">server (.env)</span>}
                    {i.inPanel && <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">panou ••••{i.last4}</span>}
                    {!i.inServer && !i.inPanel && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">nesetată</span>}
                    {i.updatedBy && <span>· {i.updatedBy}</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    <input
                      type="password" autoComplete="new-password" spellCheck={false}
                      placeholder={i.inPanel || i.inServer ? "Cheie nouă (înlocuiește)" : "Lipește cheia"}
                      value={drafts[i.name] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [i.name]: e.target.value }))}
                      className="h-8 w-full rounded border border-input bg-background px-2 font-mono text-xs sm:w-56"
                      aria-label={`Valoare pentru ${i.name}`}
                    />
                    <Button size="sm" className="h-8 bg-emerald px-3 text-xs text-white" disabled={!drafts[i.name] || busy === i.name || !state.masterKeySet} onClick={() => save(i.name, i.label)}>
                      {busy === i.name ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvează"}
                    </Button>
                    {i.testable && (
                      <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" disabled={busy === `test:${i.name}` || (!i.inPanel && !i.inServer)} onClick={() => test(i.name)}>
                        {busy === `test:${i.name}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />} Testează
                      </Button>
                    )}
                    {i.inPanel && (
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-rose-600" onClick={() => remove(i.name)} aria-label={`Șterge ${i.name}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="NUME_CHEIE_NOUA" spellCheck={false}
            className="h-8 w-56 rounded border border-input bg-background px-2 font-mono text-xs" aria-label="Numele unei integrări noi"
          />
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={addCustom}><Plus className="h-3 w-3" /> Adaugă integrare</Button>
          <span className="text-[11px] text-muted-foreground">Funcțiile de backend o citesc cu getSecret(svc, secrets, "NUME").</span>
        </div>
      )}
    </div>
  );
}
