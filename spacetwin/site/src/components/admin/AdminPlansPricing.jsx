import React from "react";
import { CreditCard, Rocket, Users, Eye } from "lucide-react";
import PlanTierEditor from "@/components/admin/PlanTierEditor";
import BoostPackEditor from "@/components/admin/BoostPackEditor";
import UserGrantsPanel from "@/components/admin/UserGrantsPanel";

// Tab-ul „Planuri & Prețuri" din Admin. RBAC:
//  - SUPER_ADMIN (și proprietarul aplicației, rolul "admin"): editează tot —
//    prețuri (sincronizate în Stripe), limite, toggle-uri, pachete de boost.
//  - ADMIN: vede structurile în mod read-only, dar poate acorda extra-limite
//    și boost-uri manuale și poate genera cupoane promoționale.
export default function AdminPlansPricing({ canEdit }) {
  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          <Eye className="h-4 w-4 shrink-0" />
          Mod vizualizare: doar SUPER_ADMIN poate edita planurile și prețurile. Poți acorda boost-uri manuale și cupoane mai jos.
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-emerald" />
          <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">Planuri de abonament</h2>
          <span className="text-xs text-muted-foreground">— prețurile noi se creează automat în Stripe și intră în vigoare imediat</span>
        </div>
        <PlanTierEditor canEdit={canEdit} />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-emerald" />
          <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">Pachete „Promovează un anunț"</h2>
        </div>
        <BoostPackEditor canEdit={canEdit} />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald" />
          <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">Acordări manuale & cupoane</h2>
        </div>
        <UserGrantsPanel />
      </section>
    </div>
  );
}