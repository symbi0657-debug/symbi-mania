import { cn } from "@/lib/utils";

export function HoloPill({ children, className, tone = "default" }) {
  return (
    <span
      className={cn(
        "ring-holo inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white",
        tone === "hot" && "text-[#ff2ed1]",
        tone === "success" && "text-[#00f0ff]",
        className
      )}
    >
      {children}
    </span>
  );
}
