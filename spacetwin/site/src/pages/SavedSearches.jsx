import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, ArrowRight } from "lucide-react";

export default function SavedSearches() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState(null);

  const load = async () => {
    try {
      const list = await base44.entities.SavedSearch.filter({ user_id: user.id }, "-created_date", 100);
      setItems(list);
    } catch (e) { setItems([]); }
  };
  useEffect(() => {
    if (isAuthenticated) load(); else setItems([]);
  }, [isAuthenticated, user?.id]);

  const remove = async (id) => {
    try { await base44.entities.SavedSearch.delete(id); toast({ title: "Căutare ștearsă" }); load(); }
    catch (e) { toast({ title: "Eroare", variant: "destructive" }); }
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold text-navy dark:text-foreground sm:text-3xl">Căutări salvate</h1>
        <p className="mt-1 text-sm text-muted-foreground">Filtrele tale preferate, gata de rulat din nou.</p>
      </div>

      {items === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-9 text-center sm:px-6 sm:py-16">
          <img src="/images/generated/icon-search.png" alt="" aria-hidden="true" className="mx-auto h-12 w-12 object-contain" />
          <p className="mt-3 font-heading text-lg font-bold text-navy dark:text-foreground">Nicio căutare salvată</p>
          <p className="mt-1 text-sm text-muted-foreground">Apasă „Salvează căutarea” pe pagina de căutare.</p>
          <Button asChild className="mt-5 h-12 rounded-full bg-emerald px-6 text-white hover:bg-emerald/90"><Link to="/search">Caută proprietăți</Link></Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => {
            const qs = s.query_string || "";
            const label = s.label || qs || "Căutare";
            return (
              <div key={s.id} className="flex min-h-[64px] items-center gap-2 rounded-xl border border-border bg-card p-2 pl-4 shadow-soft sm:gap-3">
                <Link to={`/search?${qs}`} className="flex min-h-[44px] min-w-0 flex-1 items-center">
                  <p className="truncate font-semibold text-navy dark:text-foreground">{label}</p>
                </Link>
                <Button asChild className="hidden h-11 shrink-0 gap-1.5 rounded-full bg-emerald px-5 text-white hover:bg-emerald/90 sm:inline-flex">
                  <Link to={`/search?${qs}`}>Vezi rezultate <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <button
                  onClick={() => remove(s.id)}
                  className="tap-44 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Șterge căutarea"
                  title="Șterge"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}