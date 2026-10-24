import { cn } from "@/lib/utils";

// Segmented sign in / sign up control. Squared to match the registry corners in
// the token set, not a pill. The sliding block is the only verde on the card
// besides the primary action.
export default function AuthSwitch({ mode, onChange, labels }) {
  const items = [
    { key: "signin", label: labels.signin },
    { key: "signup", label: labels.signup },
  ];

  return (
    <div className="relative flex w-full rounded border border-white/10 bg-white/[0.06] p-1">
      <div
        className={cn(
          "absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-[calc(var(--radius)-0.375rem)] bg-primary transition-transform duration-300",
          mode === "signup" && "translate-x-[calc(100%+4px)]"
        )}
        style={{ transitionTimingFunction: "var(--ease-house)" }}
        aria-hidden="true"
      />
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          aria-pressed={mode === item.key}
          className={cn(
            "relative z-10 tap-44 min-h-[34px] flex-1 rounded-[calc(var(--radius)-0.375rem)] text-[13px] font-semibold transition-colors duration-300 sm:min-h-[38px] sm:text-sm",
            mode === item.key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
