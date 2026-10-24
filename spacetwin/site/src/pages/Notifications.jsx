import React from "react";
import NotificationsPanel from "@/components/NotificationsPanel";
import { useCountry } from "@/components/CountryContext";
import { Reveal } from "@/components/ui/reveal";

// Dedicated notifications page — the destination every unread badge points
// at (header bell, site menu, bottom nav, Contul meu). Before this page the
// panel lived only inside /settings and the red dot led nowhere.
export default function Notifications() {
  const { lang } = useCountry();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <Reveal y={14}>
        <NotificationsPanel />
      </Reveal>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {lang === "en"
          ? "You get notifications in the app and by email. Manage them in Settings."
          : "Primești notificări în aplicație și pe email. Le poți gestiona din Setări."}
      </p>
    </div>
  );
}
