import { ChevronDown } from "lucide-react";

// Buton „Încarcă mai mult" pentru listele lungi din Admin. Afiseaza cate
// itemi mai raman necarcati, pentru a seta asteptarile adminului.
export default function LoadMoreButton({ onClick, remaining = 0, label = "Încarcă mai mult" }) {
  return (
    <button
      onClick={onClick}
      className="mx-auto mt-1 flex items-center gap-2 rounded border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground/80 shadow-soft transition hover:border-emerald hover:text-emerald dark:bg-card"
    >
      <ChevronDown className="h-4 w-4" />
      {label}{remaining > 0 ? ` (încă ${remaining})` : ""}
    </button>
  );
}