"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  ScanLine,
  Megaphone,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// No "Verify" screen any more: Cashfree confirms payments, so there is no
// manual approval queue to work through.
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { href: "/admin/tickets", label: "Tickets", icon: Ticket, adminOnly: true },
  { href: "/admin/checkin", label: "Check-in", icon: ScanLine, adminOnly: false },
  { href: "/admin/referrals", label: "Referrals", icon: Megaphone, adminOnly: true },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth/session", { cache: "no-store" });
      setRole(res.ok ? (await res.json()).role : null);
    } catch {
      setRole(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession, pathname]);

  // Gate staff get exactly one screen. Enforced again on every API route — this
  // redirect is a courtesy so they aren't staring at a permanently empty
  // dashboard, not a security boundary.
  useEffect(() => {
    if (checking || isLogin) return;
    if (!role) {
      router.replace("/admin/login");
    } else if (role === "gate" && pathname !== "/admin/checkin") {
      router.replace("/admin/checkin");
    }
  }, [checking, isLogin, role, pathname, router]);

  async function logout() {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // Even if the call fails, send them to the login screen.
    }
    setRole(null);
    router.replace("/admin/login");
  }

  if (isLogin) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!role) return null;

  const items = NAV.filter((i) => role === "admin" || !i.adminOnly);

  return (
    <div className="min-h-screen">
      {/* Opaque, not glass: it has to paint over the public site's fixed TopNav. */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0014]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-5">
          <Link href={role === "gate" ? "/admin/checkin" : "/admin"} className="shrink-0">
            <span className="text-holo font-display text-sm font-black tracking-widest">
              FM3
            </span>
            <span className="ml-2 hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 sm:inline">
              Admin
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {items.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/55 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <span className="hidden rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/60 sm:inline">
            {role}
          </span>
          <button
            onClick={logout}
            title="Log out"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-5">{children}</div>
    </div>
  );
}
