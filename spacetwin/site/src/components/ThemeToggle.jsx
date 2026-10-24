import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Theme switch on next-themes (ThemeProvider lives in App.jsx, storageKey
// "vc_theme" so existing users keep their saved choice). Functional control,
// so the icon stays.
export default function ThemeToggle({ withLabel = false, className }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "tap-44 flex h-9 items-center gap-2 rounded border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:border-emerald",
        className
      )}
      aria-label="Comută tema"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {withLabel && (isDark ? "Tema deschisă" : "Tema întunecată")}
    </button>
  );
}
