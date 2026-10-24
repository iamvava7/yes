import * as React from "react";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// The viewport used to be declared twice — ToastProvider and ToastViewport were
// byte-identical fixed containers, one nested inside the other, so every toast
// sat under a second empty full-height overlay. There is one container now.
//
// The enter effect is CSS, not framer-motion. A toast whose only path to being
// visible is a JavaScript tween disappears entirely whenever the frame loop is
// throttled (background tab, the app inside the Base44 editor iframe). A CSS
// keyframe runs on the compositor and, more to the point, its resting state is
// already visible — a toast that never animates is still a toast you can read.
const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Phone: top of the screen, clear of the sticky header. Desktop: the
      // usual bottom-right stack, above every piece of fixed chrome.
      "pointer-events-none fixed inset-x-0 top-0 z-[120] flex max-h-screen flex-col gap-2 p-4 pt-[calc(env(safe-area-inset-top)+4.75rem)]",
      "sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:w-full sm:flex-col-reverse sm:pt-4 md:max-w-[420px]",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

// Kept so existing imports resolve; the container above does the work.
const ToastProvider = ({ children }) => <>{children}</>;
ToastProvider.displayName = "ToastProvider";

const toastVariants = cva(
  // Deliberately no `fade-in`: keyframes carry `animation-fill-mode: both`, so a
  // fading toast sits at opacity 0 until a frame actually runs. It slides, it
  // never fades — an un-animated toast is still a fully opaque, readable toast.
  "group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-xl border p-4 pr-10 shadow-[0_18px_40px_-16px_rgba(16,24,40,0.45)] animate-in slide-in-from-top-2 duration-300 sm:slide-in-from-bottom-2",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        destructive: "destructive border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Toast = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="status" aria-live="polite" className={cn(toastVariants({ variant }), className)} {...props} />
));
Toast.displayName = "Toast";

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label="Închide"
    className={cn(
      "absolute right-2 top-2 rounded-md p-1.5 text-foreground/50 transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring group-[.destructive]:text-red-200 group-[.destructive]:hover:text-white",
      className
    )}
    {...props}
  >
    <X className="h-4 w-4" />
  </button>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm font-bold", className)} {...props} />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm text-muted-foreground group-[.destructive]:text-white/85", className)} {...props} />
));
ToastDescription.displayName = "ToastDescription";

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
