import React from "react";

/**
 * Reusable layout shell for the standalone legal documents (Terms, Privacy).
 */
export default function LegalPage({ title, updated, children }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
      <header className="mb-8 border-b border-gold/20 pb-6">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl text-navy dark:text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm font-semibold text-gold uppercase tracking-wider">
          {updated}
        </p>
      </header>
      <div className="prose-legal space-y-6 text-sm leading-relaxed text-foreground/80">
        {children}
      </div>
    </div>
  );
}