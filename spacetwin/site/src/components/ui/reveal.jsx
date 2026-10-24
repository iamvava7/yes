import React, { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

// Scroll-reveal primitives on the single house curve. One weighted ease, slow
// and deliberate, no per-index stagger spray — pacing is craft.
//
// These used to be framer-motion `whileInView` wrappers. The problem with that
// shape is that the *only* thing making the content visible was an animation
// frame: a section rendered at opacity 0 and waited for the tween to lift it.
// Whenever the frame loop stalled — a backgrounded tab, the app running inside
// the Base44 editor's iframe, a throttled phone — whole sections stayed
// invisible while still taking up their full height. That is what the blank
// band between the hero and the first row was.
//
// So the reveal is now plain CSS: the resting state IS the visible state, the
// hidden state is only ever applied once we have proof an IntersectionObserver
// is alive and reporting. If anything at all goes wrong — no IO, no callback,
// reduced motion — the content just shows. Never invisible by default.

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const SAFETY_MS = 1800; // if IO has said nothing by now, stop hiding things

const StaggerContext = createContext(null);

function useInView({ once = true, disabled = false } = {}) {
  const ref = useRef(null);
  // Armed = we are allowed to hide. Starts false so the very first paint is
  // visible content; the effect arms it only when it can also un-arm it.
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  // Layout effect, not effect: arming has to happen before the browser paints,
  // otherwise the content flashes in at full opacity and then hides itself.
  useLayoutEffect(() => {
    if (disabled) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;

    let heard = false;
    const io = new IntersectionObserver(
      (entries) => {
        heard = true;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) io.disconnect();
          } else if (!once) {
            setShown(false);
          }
        }
      },
      { rootMargin: "0px 0px -60px 0px" }
    );

    setArmed(true);
    io.observe(node);

    // Timers keep running when frames do not. If the observer never reported,
    // the reveal is broken — show the content rather than hide it forever.
    const safety = setTimeout(() => {
      if (!heard) setShown(true);
    }, SAFETY_MS);

    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, [once, disabled]);

  return [ref, !armed || shown];
}

// Cursa si durata sunt reglate pentru telefon, nu pentru monitor: pe un ecran de
// 375px un salt de 18px pe 0.9s se citeste ca o estompare lenta, nu ca miscare.
// Cursa mai lunga pe un timp mai scurt e ce face diferenta intre „se misca" si
// „nu se intampla nimic". Scara e mica intentionat — cardul ajunge la locul lui,
// nu sare in fata.
const DUR = 0.72;

function revealStyle(visible, y, delay) {
  const transition = `opacity ${DUR}s ${EASE} ${delay}s, transform ${DUR}s ${EASE} ${delay}s`;
  if (visible) {
    return { opacity: 1, transform: "none", transition };
  }
  return {
    opacity: 0,
    transform: `translateY(${y}px) scale(0.975)`,
    transition,
  };
}

export function Reveal({ children, className, delay = 0, y = 28, once = true, style, ...props }) {
  const reduced = useReducedMotion();
  const [ref, visible] = useInView({ once, disabled: reduced });

  if (reduced) {
    return (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={className} style={{ ...revealStyle(visible, y, delay), ...style }} {...props}>
      {children}
    </div>
  );
}

export function RevealGroup({ children, className, stagger = 0.1, once = true, style, ...props }) {
  const reduced = useReducedMotion();
  const [ref, visible] = useInView({ once, disabled: reduced });

  if (reduced) {
    return (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    );
  }

  return (
    <StaggerContext.Provider value={{ visible, stagger }}>
      <div ref={ref} className={className} style={style} {...props}>
        {children}
      </div>
    </StaggerContext.Provider>
  );
}

// Children of a RevealGroup ride the group's own observer and only differ by
// their transition-delay — one observer per row instead of one per card.
export function RevealItem({ children, className, y = 24, style, ...props }) {
  const reduced = useReducedMotion();
  const group = useContext(StaggerContext);
  const ref = useRef(null);
  const [index, setIndex] = useState(0);

  // Position among siblings decides the stagger step. Read from the DOM so the
  // caller never has to thread an index through a .map(). Layout effect, so the
  // delay is settled before the browser paints the first frame.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !node.parentElement) return;
    const i = Array.prototype.indexOf.call(node.parentElement.children, node);
    if (i > 0) setIndex(i);
  }, []);

  if (reduced || !group) {
    return (
      <div ref={ref} className={className} style={style} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...revealStyle(group.visible, y, index * group.stagger), ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
