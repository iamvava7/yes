import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function getItemPosition(index, activeIndex, total, radiusX, radiusY, visibleCount) {
  const offset = index - activeIndex;
  const half = Math.floor(visibleCount / 2);
  let adjustedOffset = offset;

  if (offset > half) adjustedOffset = offset - total;
  if (offset < -half) adjustedOffset = offset + total;

  if (Math.abs(adjustedOffset) > half) return null;

  const angle = (adjustedOffset / visibleCount) * Math.PI;
  const x = Math.sin(angle) * radiusX;
  const y = (1 - Math.cos(angle)) * radiusY;

  const distance = Math.abs(adjustedOffset);
  const maxDistance = half + 1;
  const scale = Math.max(0.72, 1 - (distance / maxDistance) * 0.22);
  const opacity = distance === 0 ? 1 : Math.max(0, 0.55 - (distance / maxDistance) * 0.55);
  const zIndex = visibleCount - distance;

  return { x, y, scale, opacity, zIndex, adjustedOffset };
}

export function CircularCarousel({
  items,
  activeIndex: controlledIndex,
  onActiveChange,
  autoPlay = true,
  autoPlayInterval = 4000,
  className,
}) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const intervalRef = useRef(null);
  const containerRef = useRef(null);

  const activeIndex = controlledIndex ?? internalIndex;
  const total = items.length;

  const visibleCount = isMobile ? 3 : 5;
  const radiusX = isMobile ? 130 : 190;
  const radiusY = isMobile ? 18 : 55;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const goTo = useCallback(
    (index) => {
      const newIndex = ((index % total) + total) % total;
      if (controlledIndex === undefined) {
        setInternalIndex(newIndex);
      }
      onActiveChange?.(newIndex);
    },
    [total, controlledIndex, onActiveChange],
  );

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (!autoPlay || isHovered || isFocused || isDragging) return;
    intervalRef.current = setInterval(next, autoPlayInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPlay, autoPlayInterval, isHovered, isFocused, isDragging, next]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    const el = containerRef.current;
    el?.addEventListener("keydown", handler);
    return () => el?.removeEventListener("keydown", handler);
  }, [next, prev]);

  const activeItem = items[activeIndex];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="Circular carousel"
      aria-roledescription="carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 outline-none sm:gap-5",
        className,
      )}
    >
      {/* Track — draggabil orizontal (mouse/touch); dragConstraints la 0 face din
          drag doar un gest de swipe (elastic, revine mereu la loc) — poziția
          reală a cărților rămâne controlată de activeIndex, ca și înainte. */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(e, info) => {
          setIsDragging(false);
          if (info.offset.x < -60 || info.velocity.x < -400) next();
          else if (info.offset.x > 60 || info.velocity.x > 400) prev();
        }}
        className="relative h-[240px] w-full touch-pan-y overflow-hidden sm:h-[280px]"
      >
        <AnimatePresence mode="popLayout">
          {items.map((item, i) => {
            const pos = getItemPosition(i, activeIndex, total, radiusX, radiusY, visibleCount);
            if (!pos) return null;

            const isActive = i === activeIndex;
            const Icon = item.icon;

            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  x: pos.x,
                  y: pos.y,
                  scale: pos.scale,
                  opacity: pos.opacity,
                  zIndex: pos.zIndex,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  duration: 0.65,
                  ease: [0.22, 1, 0.36, 1],
                }}
                onClick={() => goTo(i)}
                aria-label={item.title}
                aria-selected={isActive}
                role="option"
                tabIndex={isActive ? 0 : -1}
                className={cn(
                  "absolute inset-0 m-auto flex h-36 w-44 cursor-pointer flex-col items-start gap-2 overflow-hidden rounded border border-border bg-card p-3.5 shadow-soft transition-[filter] duration-300 sm:h-44 sm:w-64 sm:p-4",
                  isActive
                    ? "pointer-events-auto ring-1 ring-emerald/50"
                    : "pointer-events-none blur-[1.5px]",
                )}
              >
                <div className="flex w-full items-center gap-2.5 overflow-hidden">
                  {Icon && (
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                      <span className="absolute inset-0 rounded-full" />
                      <Icon className="relative h-7 w-7 drop-shadow-[0_3px_8px_rgba(16,24,40,0.18)]" />
                    </span>
                  )}
                  <h3
                    className={cn(
                      "line-clamp-2 break-words font-semibold leading-tight transition-colors duration-300",
                      isActive
                        ? "text-foreground text-xs sm:text-sm"
                        : "text-muted-foreground text-xs",
                    )}
                  >
                    {item.title}
                  </h3>
                </div>
                <p
                  className={cn(
                    "line-clamp-3 break-words text-[11px] leading-relaxed transition-colors duration-300",
                    isActive ? "text-muted-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {item.description}
                </p>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Counter */}
      <div className="pointer-events-none flex flex-col items-center">
        <span className="text-3xl font-bold tracking-tight text-foreground/90 sm:text-4xl">
          {String(activeIndex + 1).padStart(2, "0")}
        </span>
        <span className="mt-0.5 text-xs text-muted-foreground">
          of {String(total).padStart(2, "0")}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={prev}
          aria-label="Previous item"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-5" />
        </motion.button>

        <div className="flex items-center gap-1.5" role="tablist">
          {items.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-colors",
                i === activeIndex
                  ? "w-6 bg-foreground/80"
                  : "w-1.5 bg-foreground/20 hover:bg-foreground/40",
              )}
              aria-label={`Go to item ${i + 1}`}
            />
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={next}
          aria-label="Next item"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-5" />
        </motion.button>
      </div>
    </div>
  );
}

export default CircularCarousel;