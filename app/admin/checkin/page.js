"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";

/**
 * Result styling is the whole product here. A volunteer at a dark door with a
 * queue behind them reads colour before they read words, so each outcome owns
 * a colour they can act on without parsing text: green go, red stop, amber ask.
 */
const OUTCOMES = {
  ok: {
    title: "ADMITTED",
    ring: "border-[#00f0ff] bg-[#00f0ff]/15",
    text: "text-[#00f0ff]",
    Icon: CheckCircle2,
    vibrate: [40],
  },
  already_used: {
    title: "ALREADY USED",
    ring: "border-[#ff2ed1] bg-[#ff2ed1]/15",
    text: "text-[#ff2ed1]",
    Icon: XCircle,
    vibrate: [90, 60, 90],
  },
  not_paid: {
    title: "NOT PAID",
    ring: "border-[#ffb020] bg-[#ffb020]/15",
    text: "text-[#ffb020]",
    Icon: AlertTriangle,
    vibrate: [70, 50, 70],
  },
  not_found: {
    title: "NOT FOUND",
    ring: "border-white/40 bg-white/10",
    text: "text-white/80",
    Icon: HelpCircle,
    vibrate: [70, 50, 70],
  },
};

function clockTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function CheckinPage() {
  const inputRef = useRef(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [admitted, setAdmitted] = useState(0);
  const [scans, setScans] = useState(0);

  // The input must own focus at all times — every re-focus here exists so the
  // next person can be scanned without anyone tapping the screen first.
  const focus = () => inputRef.current?.focus();
  useEffect(focus, []);

  async function submit(e) {
    e?.preventDefault();
    const value = code.trim();
    if (!value || busy) return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResult(null);
        setError(data.error || "Check-in failed. Try again.");
      } else {
        setResult(data);
        setScans((n) => n + 1);
        if (data.result === "ok") setAdmitted((n) => n + 1);
        const cfg = OUTCOMES[data.result];
        if (cfg?.vibrate && typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(cfg.vibrate);
        }
      }
    } catch {
      setResult(null);
      setError("No connection. Check the network and scan again.");
    } finally {
      setCode("");
      setBusy(false);
      focus();
    }
  }

  const cfg = result ? OUTCOMES[result.result] || OUTCOMES.not_found : null;
  const t = result?.ticket;

  return (
    <div className="mx-auto max-w-xl space-y-4" onClick={focus}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-black tracking-wide">Check-in</h1>
        <div className="text-right">
          <p className="font-display text-2xl font-black tabular-nums text-[#00f0ff]">
            {admitted}
          </p>
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/35">
            admitted · {scans} scanned
          </p>
        </div>
      </div>

      <form onSubmit={submit}>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="FM3-XXXX-XXXX"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          inputMode="text"
          className="glass-strong w-full rounded-2xl px-4 py-6 text-center font-mono text-2xl uppercase tracking-[0.15em] text-white outline-none transition placeholder:tracking-normal placeholder:text-white/20 focus:border-[#00f0ff]/60 sm:text-3xl"
        />
        <button type="submit" className="sr-only">
          Check in
        </button>
      </form>

      <p className="text-center text-[11px] text-white/30">
        {busy ? "Checking…" : "Scan or type the Pass ID, then press Enter."}
      </p>

      {error && (
        <p className="rounded-xl border border-[#ff2ed1]/40 bg-[#ff2ed1]/10 px-4 py-3 text-center text-sm font-semibold text-[#ff8adf]">
          {error}
        </p>
      )}

      {busy && !result && (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      )}

      {cfg && (
        <div
          key={`${result.ticket?.id || result.code}-${scans}`}
          className={`zoom-in rounded-3xl border-2 px-5 py-10 text-center ${cfg.ring}`}
        >
          <cfg.Icon className={`mx-auto mb-3 h-16 w-16 ${cfg.text}`} />
          <p className={`font-display text-4xl font-black tracking-wider ${cfg.text}`}>
            {cfg.title}
          </p>

          {t?.name && (
            <p className="mt-4 font-display text-2xl font-bold text-white">{t.name}</p>
          )}
          {t?.passName && (
            <p className="mt-1 text-base font-semibold text-white/70">
              {t.passName}
              {t.entries > 1 ? ` · ${t.entries} entries` : ""}
            </p>
          )}
          {t?.id && (
            <p className="mt-2 font-mono text-xs tracking-wider text-white/40">{t.id}</p>
          )}

          {result.result === "already_used" && (
            <p className="mt-4 text-sm font-bold text-white">
              First used at {clockTime(result.checkedInAt)}
              {result.checkedInBy ? ` by ${result.checkedInBy}` : ""}
            </p>
          )}
          {result.result === "not_paid" && (
            <p className="mt-4 text-sm font-bold text-white">
              Payment status: {result.status}. Do not admit — send them to the desk.
            </p>
          )}
          {result.result === "not_found" && (
            <p className="mt-4 text-sm text-white/60">
              No pass with that ID{result.code ? ` (${result.code})` : ""}.
            </p>
          )}
        </div>
      )}

      {!cfg && !busy && !error && (
        <div className="glass rounded-2xl px-6 py-14 text-center">
          <p className="text-sm text-white/40">Ready for the first guest.</p>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-white/25">
            Dashes are optional and lowercase is fine — the ID gets cleaned up
            before it&rsquo;s looked up.
          </p>
        </div>
      )}
    </div>
  );
}
