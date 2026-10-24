import React from "react";

// Dark Immersive: value props as horizontal swipeable frosted-glass strips
// with glowing emerald icon chips.
export default function ValueStrips({ items }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scroll-px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:scroll-px-0">
      {items.map((v, i) => (
        <div
          key={i}
          className="flex min-w-[82%] snap-start items-start gap-3.5 rounded surface-card p-4 sm:min-w-0 sm:p-6"
        >
          <div className="glow-emerald flex h-10 w-10 shrink-0 items-center justify-center rounded bg-emerald/15 text-emerald sm:h-12 sm:w-12">
            <v.icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-bold text-navy dark:text-white sm:text-lg">{v.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}