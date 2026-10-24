import React, { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import SearchBar from "@/components/SearchBar";
import { useCountry } from "@/components/CountryContext";

export default function HeroSearch() {
  const { t } = useCountry();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile: compact trigger pill → swipe-down sheet */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 border border-border bg-card px-4 py-3 text-left md:hidden"
      >
        <Search className="h-4 w-4 shrink-0 text-emerald" />
        <span className="flex-1 truncate text-sm font-medium text-foreground/70">{t("sb_city")} · {t("sb_zone")}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded bg-emerald text-primary-foreground">
          <ArrowRight className="h-4 w-4" />
        </span>
      </button>

      {/* Desktop: full inline form */}
      <div className="hidden md:block">
        <SearchBar />
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="rounded-t-3xl border-border px-4 pb-8 md:hidden">
          {/* Titlul foii pornea de la 40px — px-1 plus o iconiță de 16px înaintea
              cuvântului — peste câmpurile de dedesubt, care pornesc de la 16. */}
          <DrawerTitle className="mt-4 font-heading text-base">
            {t("sb_btn")}
          </DrawerTitle>
          <div className="mt-4">
            <SearchBar onSubmitted={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}