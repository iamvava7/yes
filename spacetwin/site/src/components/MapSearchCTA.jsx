import React from "react";
import { Link } from "react-router-dom";
import { useCountry } from "@/components/CountryContext";
import LoopVideo from "@/components/LoopVideo";

// Homepage card for the map: the photograph does the talking, the scrim is a
// solid gradient to ink, the action is squared verde. No hover zoom.
export default function MapSearchCTA() {
  const { lang } = useCountry();
  const en = lang === "en";

  return (
    <div className="relative overflow-hidden border border-border">
      <div className="absolute inset-0">
        <LoopVideo
          src="/videos/map-walk-v1.mp4"
          poster="/videos/map-walk-poster.jpg"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/55 to-navy-deep/10" />

      <div className="relative flex min-h-[230px] flex-col justify-end p-6 sm:min-h-[270px] sm:p-8">
        <h3 className="font-heading text-2xl font-semibold text-white">
          {en ? "All properties on the map" : "Toate proprietățile pe hartă"}
        </h3>
        <p className="mt-1 max-w-md text-sm text-white/80">
          {en
            ? "Prices and surroundings, area by area, on the survey sheet."
            : "Prețurile și împrejurimile, zonă cu zonă, direct pe hartă."}
        </p>
        <Link
          to="/map"
          className="mt-4 w-fit rounded bg-emerald px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-emerald/90"
        >
          {en ? "View the map" : "Vezi harta"} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
