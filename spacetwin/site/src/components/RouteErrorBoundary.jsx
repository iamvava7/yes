import React from "react";
import { Link } from "react-router-dom";

/**
 * The app had no error boundary anywhere, so a single throw inside any page
 * (a bad date, a missing field) unmounted the whole tree and left a blank
 * white document — no header, no footer, nothing to act on. This catches the
 * throw, keeps the page frame, and shows what actually broke.
 */
export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the real stack reachable from the browser console in preview.
    console.error("[VerifiCasa] Route crashed:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // A crash on one route must not poison the next one.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-20 lg:px-8">
        <p className="text-[13px] font-semibold text-muted-foreground">Eroare</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          Pagina nu a putut fi afișată
        </h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          A apărut o eroare la afișarea acestei pagini. Restul site-ului
          funcționează normal.
        </p>
        <pre className="mt-5 overflow-x-auto border border-border bg-secondary p-3 text-xs text-muted-foreground">
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="min-h-[44px] rounded bg-emerald px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-emerald/90"
          >
            Încearcă din nou
          </button>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center rounded border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground"
          >
            Înapoi acasă
          </Link>
        </div>
      </div>
    );
  }
}
