"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, ScanLine, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/passes", label: "Passes", icon: Ticket },
  { to: "/my-ticket", label: "My Ticket", icon: ScanLine },
  { to: "/contact", label: "Contact", icon: Phone },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="glass-strong mx-3 mb-3 flex items-center justify-around rounded-2xl px-2 py-2">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              href={to}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5"
            >
              <Icon className={cn("h-5 w-5 transition", active ? "text-white" : "text-white/50")} />
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-wide",
                  active ? "text-white" : "text-white/50"
                )}
              >
                {label}
              </span>
              {active && <span className="bg-holo absolute -bottom-0.5 h-[3px] w-8 rounded-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
