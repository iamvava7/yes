import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/components/CountryContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PropertyEditForm from "@/components/PropertyEditForm";
import BoostDialog from "@/components/BoostDialog";
import { Image as UIImage } from "@/components/ui/image";
import { PropertyBadge } from "@/components/PropertyBadges";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { coverOf } from "@/lib/covers";
import { fetchBoostBalance } from "@/lib/boosts";

// Starea unui anunț încape într-o singură pastilă: întâi verdictul moderării,
// pentru că el decide dacă anunțul se vede, apoi starea aleasă de proprietar.
const STATUS_LABEL = {
  Activ: { ro: "Activ", en: "Active" },
  Rezervat: { ro: "Rezervat", en: "Reserved" },
  "Închis": { ro: "Închis", en: "Closed" },
};

const CHIP = "inline-flex min-h-[24px] items-center rounded-full px-2.5 py-0.5 text-xs font-bold";

function statusChip(p, en) {
  if (p.approval_status === "REJECTED") {
    return { label: en ? "Rejected" : "Respins", className: "bg-destructive/10 text-destructive" };
  }
  if (p.approval_status !== "APPROVED") {
    return {
      label: en ? "Pending" : "În așteptare",
      className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  const known = STATUS_LABEL[p.status];
  const label = known ? (en ? known.en : known.ro) : (p.status || (en ? "Active" : "Activ"));
  if (!p.status || p.status === "Activ") {
    return { label, className: "bg-emerald/10 text-emerald" };
  }
  return { label, className: "bg-secondary text-muted-foreground" };
}

// Anunțurile proprii — un rând compact pe anunț: fotografia conduce, prețul se
// citește primul, iar starea și acțiunile stau sub el.
export default function MyProperties() {
  const { user } = useAuth();
  const { formatPrice, t, lang } = useCountry();
  const { toast } = useToast();
  const en = lang === "en";
  const [properties, setProperties] = useState(null);
  const [editing, setEditing] = useState(null);
  const [balance, setBalance] = useState(0);
  const [boostTarget, setBoostTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    if (!user?.id) return;
    try {
      const ps = await base44.entities.Property.filter({ created_by_id: user.id }, "-created_date", 100);
      setProperties(ps);
    } catch (e) {
      setProperties([]);
    }
  };

  const loadBalance = async () => {
    if (!user?.id) return;
    setBalance(await fetchBoostBalance(user.id));
  };

  useEffect(() => { load(); loadBalance();   }, [user?.id]);

  // Întoarcerea din plata unui boost cumpărat de pe un anunț. Funcția de
  // backend a aplicat deja boost-ul; aici doar confirmăm și reîncărcăm.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const boost = params.get("boost");
    const sessionId = params.get("session_id");
    if (!boost) return;
    if (boost === "success" && sessionId) {
      base44.functions
        .invoke("VerifyBoostCheckout", { session_id: sessionId })
        .then((res) => {
          const data = res?.data || res || {};
          if (data.error) {
            toast({ title: en ? "Could not confirm the payment" : "Nu am putut confirma plata", description: data.error, variant: "destructive" });
          } else if (data.applied_to) {
            toast({
              title: en ? "Listing promoted" : "Anunț promovat",
              description: en ? "Your listing is now boosted." : "Anunțul tău este acum promovat.",
            });
          } else {
            toast({
              title: en ? "Boosts added" : "Boost-uri adăugate",
              description: en ? "They are in your balance." : "Le găsești în soldul tău.",
            });
          }
          load(); loadBalance();
        })
        .catch(() => {});
    } else if (boost === "cancelled") {
      toast({ title: en ? "Payment cancelled" : "Plată anulată", description: en ? "You were not charged." : "Nicio sumă nu a fost taxată." });
    }
    params.delete("boost"); params.delete("session_id");
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;
    const unsub = base44.entities.Property.subscribe(() => load());
    return () => { try { unsub && unsub(); } catch { /* noop */ } };

  }, [user?.id]);

  // Soldul de boost-uri (BoostCredit) e o entitate separată de Property, deci
  // nu intra în subscribe-ul de mai sus. Fără asta, promovarea dintr-un alt
  // tab/pagină — sau chiar din același tab, dacă răspunsul de rețea întârzie —
  // rămâne "în urmă" până la un refresh manual.
  useEffect(() => {
    if (!user?.id) return undefined;
    const unsub = base44.entities.BoostCredit.subscribe(() => loadBalance());
    return () => { try { unsub && unsub(); } catch { /* noop */ } };
  }, [user?.id]);


  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await base44.entities.Property.delete(deleteTarget.id);
      toast({ title: en ? "Listing deleted" : "Anunț șters" });
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast({ title: en ? "Could not delete" : "Eroare la ștergere", variant: "destructive" });
    }
  };

  if (properties === null) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-9 w-56 rounded-full" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const empty = properties.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            {en ? "My listings" : "Anunțurile mele"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-bold text-foreground tnum">{balance}</span>{" "}
            {en ? "boosts available" : "boost-uri disponibile"}
          </p>
        </div>
        {!empty && (
          <Button asChild className="min-h-[44px] rounded-full bg-emerald px-5 text-primary-foreground hover:bg-emerald/90">
            <Link to="/post-property">{en ? "Add a listing" : "Adaugă anunț"}</Link>
          </Button>
        )}
      </div>

      {empty ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-card px-5 py-9 text-center sm:mt-8 sm:px-6 sm:py-14">
          <p className="font-heading text-lg font-semibold text-foreground sm:text-xl">
            {en ? "Nothing published yet." : "Nu ai adăugat niciun anunț încă."}
          </p>
          <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
            {en
              ? "Five steps to publish. We verify the listing before it shows up in search."
              : "Îl publici în cinci pași, iar noi îl verificăm înainte să apară în căutare."}
          </p>
          <Button asChild className="mt-5 min-h-[44px] rounded-full bg-emerald px-6 text-primary-foreground hover:bg-emerald/90">
            <Link to="/post-property">{en ? "Add a listing" : "Adaugă anunț"}</Link>
          </Button>
        </div>
      ) : (
        <RevealGroup className="mt-5 space-y-3 sm:mt-8">
          {properties.map((p) => {
            const boosted = p.boost_active;
            const boostUntil = p.boost_ends_date
              ? new Date(p.boost_ends_date).toLocaleDateString(en ? "en-GB" : "ro-RO", { day: "2-digit", month: "short" })
              : null;
            const approved = p.approval_status === "APPROVED";
            const chip = statusChip(p, en);
            const cover = coverOf(p);
            const specs = [
              [p.zone, p.city].filter(Boolean).join(", "),
              p.rooms != null && `${p.rooms} ${en ? (p.rooms === 1 ? "room" : "rooms") : "cam."}`,
              p.surface_sqm != null && `${p.surface_sqm} mp`,
            ].filter(Boolean).join(" · ");

            return (
              <RevealItem key={p.id}>
                <article className="rounded-2xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4">
                  <Link to={`/property/${p.id}`} className="flex gap-3 sm:gap-4">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-28 sm:w-40">
                      {cover ? (
                        <UIImage src={cover} alt={p.title || ""} fittingType="fill" className="h-full w-full object-cover" />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[15px] font-semibold text-foreground">{p.title}</p>

                      <p className="mt-1 text-xl font-bold leading-none text-foreground tnum">
                        {formatPrice(p.price_monthly, p.currency)}
                        <span className="ml-1 text-xs font-semibold text-muted-foreground">
                          {p.transaction_type === "SALE" ? "" : t("pc_permonth")}
                        </span>
                      </p>

                      {specs && <p className="mt-1.5 truncate text-sm text-muted-foreground">{specs}</p>}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`${CHIP} ${chip.className}`}>{chip.label}</span>
                        {boosted && (
                          <PropertyBadge kind="promovat" size="sm" lang={lang}>
                            {boostUntil ? (en ? `Promoted · ${boostUntil}` : `Promovat · ${boostUntil}`) : undefined}
                          </PropertyBadge>
                        )}
                        <span className="text-xs text-muted-foreground tnum">
                          {p.views_count || 0} {en ? "views" : "vizite"}
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:flex sm:justify-end">
                    <Button
                      onClick={() => setBoostTarget(p)}
                      disabled={!approved}
                      title={!approved ? (en ? "Approve the listing first" : "Anunțul trebuie aprobat întâi") : undefined}
                      className="min-h-[44px] w-full rounded-full bg-emerald px-2 text-xs text-primary-foreground hover:bg-emerald/90 disabled:opacity-50 sm:w-auto sm:px-5 sm:text-sm"
                    >
                      {boosted ? (en ? "Promote more" : "Promovează mai mult") : (en ? "Promote" : "Promovează")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditing(editing === p.id ? null : p.id)}
                      className="min-h-[44px] w-full rounded-full border-border px-2 text-xs sm:w-auto sm:px-5 sm:text-sm"
                    >
                      {en ? "Edit" : "Editează"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteTarget(p)}
                      className="min-h-[44px] w-full rounded-full border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10 sm:w-auto sm:px-5 sm:text-sm"
                    >
                      {en ? "Delete" : "Șterge"}
                    </Button>
                  </div>

                  {editing === p.id && (
                    <div className="mt-4 border-t border-border pt-4">
                      <PropertyEditForm property={p} onDone={() => { setEditing(null); load(); }} />
                    </div>
                  )}
                </article>
              </RevealItem>
            );
          })}
        </RevealGroup>
      )}

      <BoostDialog
        open={!!boostTarget}
        onOpenChange={(v) => !v && setBoostTarget(null)}
        property={boostTarget}
        balance={balance}
        onDone={(res) => { setBalance(res.balance ?? balance - 1); load(); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-semibold">
              {en ? "Delete this listing?" : "Ștergi acest anunț?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {en
                ? `"${deleteTarget?.title || ""}" will be removed from search and from the map. This cannot be undone from here.`
                : `„${deleteTarget?.title || ""}" va fi scos din căutare și de pe hartă. Acțiunea nu poate fi anulată de aici.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px] rounded-full border-border">
              {en ? "Cancel" : "Anulează"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="min-h-[44px] rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {en ? "Delete" : "Șterge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
