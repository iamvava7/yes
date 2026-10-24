import React from "react";
import { cn } from "@/lib/utils";

/**
 * A silent looping video band.
 *
 * The default is the browser's own loop on a single <video>: zero JS, one
 * decoder, no per-frame work. That is the correct mode whenever the clip's last
 * frame matches its first AND the camera does not decelerate into it — the
 * condition /videos/map-walk-v1.mp4 meets and the old hero clip did not.
 *
 * `crossfade` (seconds, 0 = off) is the escape hatch for a clip that does not
 * close on itself: a second copy of the same file is dissolved in over the join.
 * It is opt-in and it is not free. A dissolve is a per-pixel blend, so it cannot
 * change either layer's motion — it superimposes two moving images and reads as
 * double exposure for its whole duration. It buys a soft join at that price.
 * Keep it short (~0.3s), or keep it at 0 and ship a clip that closes.
 *
 * prefers-reduced-motion holds the poster and fetches no video at all.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

// Start the incoming copy this far ahead of the dissolve, so alpha never rises
// on a frame that is still decoding.
const PLAY_LEAD = 0.3;

function subscribeReduced(onChange) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// useSyncExternalStore, not an effect: correct on the first render, before any
// frame paints, so the video element can carry `autoPlay` as an attribute and
// start before hydration instead of waiting for a scripted play().
function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

export default function LoopVideo({
  src,
  poster,
  className,
  objectPosition = "center",
  crossfade = 0,
}) {
  const holdStill = useReducedMotion();
  // Any media error collapses the component back to one element on the native
  // loop. It unmounts the pair rather than hiding the broken half, so the
  // replacement element re-attempts the load from scratch and we can never park
  // a dead frame on top of a healthy copy.
  const [failed, setFailed] = React.useState(false);
  // The second copy is not mounted until the first has buffered, so page load
  // costs one file and the two requests never compete for bandwidth.
  const [pairReady, setPairReady] = React.useState(false);

  const driven = crossfade > 0 && !holdStill && !failed;

  const wrapRef = React.useRef(null);
  const aRef = React.useRef(null);
  const bRef = React.useRef(null);
  const activeRef = React.useRef(0);

  React.useEffect(() => {
    if (!driven) {
      setPairReady(false);
      return undefined;
    }
    const el = aRef.current;
    if (!el) return undefined;
    if (el.readyState >= 3) {
      setPairReady(true);
      return undefined;
    }
    const ready = () => setPairReady(true);
    el.addEventListener("canplaythrough", ready, { once: true });
    return () => el.removeEventListener("canplaythrough", ready);
  }, [driven, src]);

  React.useEffect(() => {
    if (!driven || !pairReady) return undefined;
    const els = [aRef.current, bRef.current];
    const wrap = wrapRef.current;
    if (!els[0] || !els[1] || !wrap) return undefined;

    let cancelled = false;
    let raf = 0;
    let fadeStart = 0; // wall clock ms; 0 means no dissolve in flight
    let armed = false;
    let onScreen = true;
    const cleanups = [];
    const on = (target, type, fn) => {
      target.addEventListener(type, fn);
      cleanups.push(() => target.removeEventListener(type, fn));
    };

    // React can assign the muted property later than iOS evaluates play(), and
    // an unmuted autoplay is refused outright.
    els.forEach((el) => {
      el.muted = true;
    });

    const live = () => els[activeRef.current];
    const idle = () => els[1 - activeRef.current];

    const play = (el) => {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          // pause() racing a pending play() rejects with AbortError — our own
          // doing when the tab hides or the band scrolls away, not a fault.
          if (cancelled || (err && err.name === "AbortError")) return;
          setFailed(true);
        });
      }
    };

    const rewind = (el) => {
      try {
        el.currentTime = 0;
      } catch {
        // readyState 0: nothing to seek yet, the next cycle retries.
      }
    };

    // The incoming copy always dissolves in *over* the outgoing one: a single
    // alpha ramp, so no luminance dip at the midpoint and no background bleed.
    const settle = () => {
      const l = live();
      const i = idle();
      l.style.opacity = "1";
      l.style.zIndex = "1";
      l.style.willChange = "auto";
      i.style.opacity = "0";
      i.style.zIndex = "2";
      i.style.willChange = "auto";
      i.pause();
      rewind(i);
      fadeStart = 0;
      armed = false;
    };

    const commit = () => {
      const out = live();
      const inc = idle();
      inc.style.opacity = "1";
      inc.style.zIndex = "1";
      inc.style.willChange = "auto";
      out.style.opacity = "0";
      out.style.zIndex = "2";
      out.style.willChange = "auto";
      out.pause();
      rewind(out); // parked at frame 0, primed for the next hand-off
      activeRef.current = 1 - activeRef.current;
      fadeStart = 0;
      armed = false;
    };

    const tick = () => {
      if (cancelled) return;
      raf = requestAnimationFrame(tick);

      const cur = live();
      const other = idle();
      const d = cur.duration;
      if (!Number.isFinite(d) || d <= 0) return; // metadata not in yet

      const fade = Math.max(0.15, Math.min(crossfade, d * 0.35));
      const openAt = d - fade;
      const at = cur.currentTime;

      if (!armed && at >= openAt - PLAY_LEAD) {
        armed = true;
        if (other.readyState >= 2) {
          rewind(other);
          cur.style.willChange = "opacity";
          other.style.willChange = "opacity";
          play(other);
        }
      }

      if (!fadeStart && at >= openAt) {
        if (other.readyState < 2 || other.paused) {
          // The incoming copy is not moving. Dissolving into a frozen frame is
          // worse than the join, so take the join this once and retry next cycle.
          settle();
          rewind(cur);
          play(cur);
          return;
        }
        fadeStart = performance.now();
      }

      if (fadeStart) {
        // Wall clock, not media time: the outgoing copy's currentTime stops the
        // instant it ends, which would strand the dissolve part-way.
        const t = Math.min((performance.now() - fadeStart) / (fade * 1000), 1);
        other.style.opacity = String(t * t * (3 - 2 * t)); // smoothstep
        if (t >= 1) commit();
      }
    };

    const stop = () => {
      if (fadeStart) commit();
      else settle();
      els.forEach((el) => el.pause());
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const start = () => {
      if (raf) return;
      play(live());
      raf = requestAnimationFrame(tick);
    };

    const sync = () => {
      if (onScreen && !document.hidden) start();
      else stop();
    };

    // rAF is dead in a hidden tab, so a dissolve caught in flight would freeze
    // half-mixed. Commit or settle first, so the pair is only ever parked with a
    // single visible copy.
    on(document, "visibilitychange", sync);
    els.forEach((el) => on(el, "error", () => setFailed(true)));

    // Safety net. The hand-off rides on rAF, which a browser is free to starve
    // (a throttled tab, a pane that is not compositing). With the native loop
    // off, a starved driver would leave the band parked on its last frame
    // forever. If an element reaches the end with no dissolve in flight, take
    // the hard join: a visible cut every cycle beats a frozen picture.
    els.forEach((el) =>
      on(el, "ended", () => {
        if (cancelled || fadeStart) return;
        settle();
        rewind(el);
        play(el);
      }),
    );

    // Off-screen the band costs a rAF loop and two decoders for nothing. The map
    // band in particular sits far below the fold for most of a session.
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        sync();
      },
      { rootMargin: "128px" },
    );
    io.observe(wrap);

    settle();
    sync();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      cleanups.forEach((f) => f());
    };
  }, [driven, pairReady, src, crossfade]);

  const layer = "absolute inset-0 h-full w-full object-cover";

  return (
    // `isolate` is load-bearing: without a stacking context here the stacked
    // videos' z-index escapes into the ancestor context and paints over the
    // scrim, the copy and the link in MapSearchCTA.
    <div
      ref={wrapRef}
      className={cn("relative isolate h-full w-full overflow-hidden", className)}
      aria-hidden="true"
    >
      <video
        ref={aRef}
        className={layer}
        style={driven ? { objectPosition, opacity: 1, zIndex: 1 } : { objectPosition }}
        // Reduced motion fetches nothing at all — the poster is the whole band.
        src={holdStill ? undefined : src}
        poster={poster}
        autoPlay={!holdStill}
        // Until the second copy is mounted and buffered, the browser owns the
        // join. One cut on the first cycle beats a frozen last frame.
        loop={!driven || !pairReady}
        muted
        playsInline
        preload={holdStill ? "none" : "auto"}
        tabIndex={-1}
      />
      {driven && pairReady ? (
        <video
          ref={bRef}
          className={layer}
          style={{ objectPosition, opacity: 0, zIndex: 2 }}
          src={src}
          poster={poster}
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
        />
      ) : null}
    </div>
  );
}
