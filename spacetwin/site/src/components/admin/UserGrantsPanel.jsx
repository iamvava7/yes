import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, Gift, TicketPercent } from "lucide-react";

// Acordări manuale: caută un utilizator după nume/email/ID și acordă-i
// extra-limite (anunțuri, tururi 3D) sau boost-uri, fără a-i schimba planul.
// Plus generarea de cupoane promoționale. Disponibil TUTUROR adminilor.
export default function UserGrantsPanel() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [override, setOverride] = useState(null);
  const [form, setForm] = useState({ extra_listings: "", extra_tours: "", boost_credits: "", note: "" });
  const [granting, setGranting] = useState(false);
  const [coupon, setCoupon] = useState({ code: "", bonus_boosts: 1, max_uses: 0 });
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  useEffect(() => {
    base44.entities.User.list("-created_date", 200).then(setUsers).catch(() => setUsers([]));
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? users.filter((u) =>
        (u.email || "").toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.id || "").toLowerCase().startsWith(q)
      ).slice(0, 6)
    : [];

  const pick = async (u) => {
    setSelected(u);
    setQuery("");
    try {
      const rows = await base44.entities.UserOverride.filter({ user_id: u.id }, "-updated_date", 1);
      const o = rows?.[0] || null;
      setOverride(o);
      setForm({
        extra_listings: o?.extra_listings ?? "",
        extra_tours: o?.extra_tours ?? "",
        boost_credits: "",
        note: o?.note || "",
      });
    } catch { setOverride(null); }
  };

  const grant = async () => {
    if (!selected) return;
    setGranting(true);
    try {
      const payload = { user_id: selected.id, note: form.note };
      if (form.extra_listings !== "") payload.extra_listings = Number(form.extra_listings);
      if (form.extra_tours !== "") payload.extra_tours = Number(form.extra_tours);
      if (Number(form.boost_credits) > 0) payload.boost_credits = Number(form.boost_credits);
      const res = await base44.functions.invoke("AdminGrantUserOverride", payload);
      if (res?.data?.ok) {
        toast({ title: "Acordat", description: (res.data.results || []).join(" · ") });
        pick(selected);
      } else {
        toast({ title: "Eroare", description: res?.data?.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Eroare", description: e?.message, variant: "destructive" });
    } finally { setGranting(false); }
  };

  const createCoupon = async () => {
    const code = coupon.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) { toast({ title: "Introdu un cod", variant: "destructive" }); return; }
    setCreatingCoupon(true);
    try {
      await base44.entities.Coupon.create({
        code, bonus_boosts: Number(coupon.bonus_boosts) || 0,
        max_uses: Number(coupon.max_uses) || 0, active: true,
      });
      toast({ title: "Cupon creat", description: `${code} — ${coupon.bonus_boosts} boost-uri bonus` });
      setCoupon({ code: "", bonus_boosts: 1, max_uses: 0 });
    } catch (e) {
      toast({ title: "Eroare la crearea cuponului", description: e?.message, variant: "destructive" });
    } finally { setCreatingCoupon(false); }
  };

  const inputCls = "w-full rounded border border-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald dark:bg-card";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Grant per utilizator */}
      <div className="rounded border border-border bg-white p-4 dark:bg-card">
        <div className="mb-2 flex items-center gap-2">
          <Gift className="h-4 w-4 text-emerald" />
          <h3 className="font-heading font-bold text-navy dark:text-foreground">Extra-limite pentru un utilizator</h3>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută după nume, email sau ID…"
            className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald dark:bg-card" />
          {matches.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded border border-border bg-white shadow-lg dark:bg-card">
              {matches.map((u) => (
                <button key={u.id} onClick={() => pick(u)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary/60">
                  <span className="font-semibold">{u.full_name || u.email}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-3 space-y-2">
            <p className="text-sm">
              <b>{selected.full_name || selected.email}</b>
              <span className="ml-1 text-xs text-muted-foreground">{selected.email} · rol {selected.role || "user"}</span>
            </p>
            {override && (
              <p className="text-xs text-muted-foreground">
                Override curent: +{override.extra_listings || 0} anunțuri · +{override.extra_tours || 0} tururi 3D
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">+ Anunțuri active</span>
                <input type="number" min="0" value={form.extra_listings} onChange={(e) => setForm((f) => ({ ...f, extra_listings: e.target.value }))} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">+ Tururi 3D</span>
                <input type="number" min="0" value={form.extra_tours} onChange={(e) => setForm((f) => ({ ...f, extra_tours: e.target.value }))} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">+ Boost-uri (acum)</span>
                <input type="number" min="0" value={form.boost_credits} onChange={(e) => setForm((f) => ({ ...f, boost_credits: e.target.value }))} className={inputCls} />
              </label>
            </div>
            <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Notă (opțional)" className={inputCls} />
            <Button onClick={grant} disabled={granting} className="gap-1.5 bg-emerald text-white">
              {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Acordă
            </Button>
          </div>
        )}
      </div>

      {/* Cupoane promoționale */}
      <div className="rounded border border-border bg-white p-4 dark:bg-card">
        <div className="mb-2 flex items-center gap-2">
          <TicketPercent className="h-4 w-4 text-emerald" />
          <h3 className="font-heading font-bold text-navy dark:text-foreground">Cupon promoțional</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Cuponul acordă boost-uri bonus la revendicare (din Contul meu).</p>
        <div className="space-y-2">
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">Cod</span>
            <input value={coupon.code} onChange={(e) => setCoupon((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
              placeholder="ex: VARA2026" className={inputCls + " font-mono uppercase"} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">Boost-uri bonus</span>
              <input type="number" min="1" value={coupon.bonus_boosts} onChange={(e) => setCoupon((c) => ({ ...c, bonus_boosts: e.target.value }))} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">Utilizări max (0 = nelimitat)</span>
              <input type="number" min="0" value={coupon.max_uses} onChange={(e) => setCoupon((c) => ({ ...c, max_uses: e.target.value }))} className={inputCls} />
            </label>
          </div>
          <Button onClick={createCoupon} disabled={creatingCoupon} className="gap-1.5 bg-emerald text-white">
            {creatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketPercent className="h-4 w-4" />} Creează cuponul
          </Button>
        </div>
      </div>
    </div>
  );
}