import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  KNOWN_INTEGRATIONS, MASTER_SECRET, getSecret, lastFour, sealSecret, validName,
} from "../../shared/integrations.js";

// Admin → Integrări & chei API. Doar SUPER_ADMIN (sau proprietarul aplicației,
// rolul built-in "admin").
//
//   { action: "list" }                         → integrările, cu stare, fără valori
//   { action: "save", name, value, label? }    → criptează și salvează (înlocuiește)
//   { action: "delete", name }                 → șterge valoarea salvată din panou
//   { action: "test", name }                   → verifică cheia la furnizor
//
// Valorile nu se întorc NICIODATĂ în răspuns: doar ultimele 4 caractere.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });
    const roleUp = (me.role || "").toUpperCase();
    if (!(roleUp === "SUPER_ADMIN" || me.role === "admin")) {
      return Response.json({ error: "Doar SUPER_ADMIN poate vedea și modifica cheile API." });
    }

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const action = String(body?.action || "list");
    const svc = base44.asServiceRole;
    const master = secrets.get(MASTER_SECRET);

    if (action === "list") {
      const rows: any[] = await svc.entities.IntegrationSecret.list("-updated_date", 200).catch(() => []);
      const byName = new Map(rows.map((r) => [r.name, r]));
      const names = [...new Set([...KNOWN_INTEGRATIONS.map((k) => k.name), ...rows.map((r) => r.name)])];
      const items = names.map((name) => {
        const known = KNOWN_INTEGRATIONS.find((k) => k.name === name);
        const row: any = byName.get(name);
        return {
          name,
          label: row?.label || known?.label || name,
          group: known?.group || "Altele",
          testable: !!known?.test,
          inServer: !!(secrets.fromServer ? secrets.fromServer(name) : secrets.get(name)), // variabilă pe server (.env) — are prioritate
          inPanel: !!row,
          last4: row?.last4 || "",
          updatedAt: row?.updated_date || null,
          updatedBy: row?.updated_by_name || null,
        };
      });
      return Response.json({ ok: true, items, masterKeySet: !!master });
    }

    const name = String(body?.name || "");
    if (!validName(name)) return Response.json({ error: "Nume invalid: litere, cifre și _, începând cu o literă." });

    if (action === "save") {
      if (!master) return Response.json({ error: `Setează întâi ${MASTER_SECRET} în fișierul .env de pe server (o frază lungă, aleatorie) și repornește serverul.` });
      const value = String(body?.value ?? "").trim();
      if (value.length < 8 || value.length > 4096) return Response.json({ error: "Cheia pare incompletă (minim 8 caractere)." });
      const sealed = await sealSecret(master, value);
      const label = String(body?.label || "").slice(0, 120);
      const rows: any[] = await svc.entities.IntegrationSecret.filter({ name }, "-updated_date", 1);
      const data = { name, ...sealed, last4: lastFour(value), updated_by_name: me.full_name || me.email, ...(label ? { label } : {}) };
      if (rows?.[0]) await svc.entities.IntegrationSecret.update(rows[0].id, data);
      else await svc.entities.IntegrationSecret.create(data);
      await audit(svc, me, roleUp, "save_integration", name);
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      const rows: any[] = await svc.entities.IntegrationSecret.filter({ name }, "-updated_date", 10);
      for (const r of rows || []) await svc.entities.IntegrationSecret.delete(r.id);
      await audit(svc, me, roleUp, "delete_integration", name);
      return Response.json({ ok: true, removed: (rows || []).length });
    }

    if (action === "test") {
      const known = KNOWN_INTEGRATIONS.find((k) => k.name === name);
      if (!known?.test) return Response.json({ error: "Pentru cheia asta nu există un test automat." });
      const value = await getSecret(svc, secrets, name);
      if (!value) return Response.json({ ok: false, result: "Cheia nu e setată." });
      return Response.json(await testKey(known.test, value));
    }

    return Response.json({ error: `Acțiune necunoscută: ${action}` });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}

// Un apel citire-doar la furnizor; nu modifică nimic și nu costă nimic.
async function testKey(kind: string, value: string): Promise<any> {
  const ok = (result: string) => ({ ok: true, result });
  const fail = (result: string) => ({ ok: false, result });
  try {
    if (kind === "stripe") {
      const r = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${value}` } });
      const j: any = await r.json().catch(() => null);
      return r.ok ? ok(`Stripe răspunde (${j?.livemode ? "LIVE" : "test"}).`) : fail(j?.error?.message || `Stripe: HTTP ${r.status}`);
    }
    if (kind === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": value, "anthropic-version": "2023-06-01" } });
      return r.ok ? ok("Anthropic răspunde — Maria poate folosi Claude.") : fail(`Anthropic: HTTP ${r.status}`);
    }
    if (kind === "google_maps") {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Bucuresti&key=${encodeURIComponent(value)}`);
      const j: any = await r.json().catch(() => null);
      return j?.status === "OK" ? ok("Google Maps răspunde.") : fail(`Google Maps: ${j?.status || r.status} ${j?.error_message || ""}`.trim());
    }
    return fail("Test necunoscut.");
  } catch (e: any) {
    return fail(e?.message || String(e));
  }
}

async function audit(svc: any, me: any, roleUp: string, action: string, name: string) {
  try {
    await svc.entities.AuditLog.create({
      actor_id: me.id, actor_name: me.full_name || me.email, actor_role: roleUp,
      action, target_type: "integration", target_id: name, detail: name,
    });
  } catch (_) { /* best-effort */ }
}
