"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { HoloButton } from "@/components/holo/HoloButton";

export default function AdminLoginPage() {
  const router = useRouter();
  const inputRef = useRef(null);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy || !password) return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError("Too many attempts. Wait 15 minutes before trying again.");
      } else if (!res.ok) {
        setError(data.error || "Incorrect password");
      } else {
        // middleware.js bounces unauthenticated admins here with ?next=…, so
        // send them back where they were aiming. Read off window rather than
        // useSearchParams: the hook would force this page out of static
        // prerendering for a value only needed at submit time. Only same-origin
        // admin paths are honoured — an open redirect on a login page is how
        // you get phished.
        let dest = data.role === "gate" ? "/admin/checkin" : "/admin";
        const next = new URLSearchParams(window.location.search).get("next");
        if (data.role === "admin" && next && /^\/admin(\/|$)/.test(next)) {
          dest = next;
        }
        router.replace(dest);
        router.refresh();
        return;
      }

      setPassword("");
      setShake(true);
      setTimeout(() => setShake(false), 450);
      inputRef.current?.focus();
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-24">
      <div
        className={`glass-strong w-full max-w-sm rounded-3xl p-7 ${shake ? "animate-shake" : "slide-up"}`}
      >
        <div className="mb-6 text-center">
          <div className="bg-holo mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl">
            <Lock className="h-5 w-5 text-black" />
          </div>
          <h1 className="text-holo font-display text-lg font-black tracking-widest">
            FM3 ADMIN
          </h1>
          <p className="mt-1.5 text-xs text-white/45">
            Enter your password to continue
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="glass w-full rounded-2xl px-4 py-3.5 text-center text-base tracking-widest text-white outline-none transition placeholder:tracking-normal placeholder:text-white/25 focus:border-white/30"
          />

          {error && (
            <p className="rounded-xl border border-[#ff2ed1]/40 bg-[#ff2ed1]/10 px-3 py-2 text-center text-xs font-semibold text-[#ff8adf]">
              {error}
            </p>
          )}

          <HoloButton type="submit" disabled={busy || !password} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </HoloButton>
        </form>

        <p className="mt-5 text-center text-[10px] leading-relaxed text-white/25">
          Gate staff: use the gate password to go straight to check-in.
        </p>
      </div>
    </div>
  );
}
