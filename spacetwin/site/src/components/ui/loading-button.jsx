import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const CELL = { type: "spring", stiffness: 520, damping: 34, mass: 0.45 };
const CROSSFADE = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 };
const INSTANT = { duration: 0 };

export const useAsyncAction = ({ action, resetAfter = 1400, onError }) => {
  const [status, setStatus] = useState("idle");
  const phase = useRef("idle");
  const runId = useRef(0);
  const timer = useRef(null);
  const alive = useRef(true);
  const act = useRef(action);
  const fail = useRef(onError);

  useEffect(() => { act.current = action; fail.current = onError; });

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    clear();
    phase.current = "idle";
    setStatus("idle");
  }, [clear]);

  const run = useCallback(() => {
    if (phase.current === "pending") return;
    clear();
    const id = ++runId.current;
    phase.current = "pending";
    setStatus("pending");

    const settle = (next) => {
      if (!alive.current || id !== runId.current) return;
      clear();
      phase.current = next;
      setStatus(next);
      timer.current = setTimeout(() => {
        if (!alive.current || id !== runId.current) return;
        phase.current = "idle";
        setStatus("idle");
      }, resetAfter);
    };

    Promise.resolve().then(() => act.current()).then(
      () => settle("success"),
      (error) => { fail.current?.(error); settle("error"); }
    );
  }, [clear, resetAfter]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; clear(); };
  }, [clear]);

  return { status, run, reset, pending: status === "pending" };
};

function Spinner({ still }) {
  return (
    <motion.svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0"
      animate={still ? undefined : { rotate: 360 }}
      transition={still ? undefined : { duration: 0.85, repeat: Infinity, ease: "linear" }}>
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
      <path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </motion.svg>
  );
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2.6 6.3 4.9 8.6 9.4 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M6 2.9v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 9.05h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export const LoadingButton = ({
  onAction,
  children,
  pendingLabel = children,
  successLabel = "Done",
  errorLabel = "Try again",
  resetAfter = 1400,
  disabled = false,
  onError,
  className = "",
}) => {
  const reduced = useReducedMotion();
  const { status, run, pending } = useAsyncAction({ action: onAction, resetAfter, onError });
  const fade = reduced ? INSTANT : CROSSFADE;

  const label =
    status === "pending" ? pendingLabel
    : status === "success" ? successLabel
    : status === "error" ? errorLabel
    : children;

  const faces = [
    { key: "idle", text: children, tone: "text-white", icon: null },
    { key: "pending", text: pendingLabel, tone: "text-white/90", icon: <Spinner still={reduced === true || status !== "pending"} /> },
    { key: "success", text: successLabel, tone: "text-white", icon: <CheckMark /> },
    { key: "error", text: errorLabel, tone: "text-red-100", icon: <AlertMark /> },
  ];

  return (
    <>
      <motion.button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-busy={pending || undefined}
        aria-disabled={pending || undefined}
        whileTap={disabled || pending || reduced ? undefined : { y: 1 }}
        transition={CELL}
        onClick={(event) => { if (pending) { event.preventDefault(); return; } run(); }}
        className={`relative inline-flex h-12 select-none items-center justify-center rounded border border-emerald/40 bg-emerald px-6 text-sm font-semibold text-white shadow-soft outline-none transition hover:bg-emerald/90 disabled:opacity-50 ${className}`}
        style={{ touchAction: "manipulation" }}
      >
        <span aria-hidden className="relative grid place-items-center">
          {faces.map((face) => (
            <motion.span
              key={face.key}
              initial={false}
              animate={face.key === status ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 3, filter: "blur(3px)" }}
              transition={fade}
              className={`col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap ${face.tone}`}
            >
              {face.icon}
              {face.text}
            </motion.span>
          ))}
        </span>
      </motion.button>

      <span role="status" aria-live="polite" className="sr-only">
        {status === "success" ? successLabel : status === "error" ? errorLabel : ""}
      </span>
    </>
  );
};

export default LoadingButton;