"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export function HoloButton({ className, variant = "primary", asChild, children, ...props }) {
  const Comp = asChild ? Slot : "button";
  if (variant === "ghost") {
    return (
      <Comp
        className={cn(
          "glass relative inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold tracking-wide text-white/90 transition hover:text-white active:scale-[0.98]",
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }
  return (
    <Comp
      className={cn(
        "text-shimmer relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-sm font-bold tracking-wide text-black transition active:scale-[0.98]",
        "bg-holo animate-pulse-glow",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
