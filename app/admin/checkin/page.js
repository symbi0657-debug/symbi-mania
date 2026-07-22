"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Loader2, Camera, CameraOff } from "lucide-react";
import jsQR from "jsqr";

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
  const [scanning, setScanning] = useState(false);

  const busyRef = useRef(false);
  const scanningRef = useRef(false);
  scanningRef.current = scanning;

  // The input must own focus at all times — every re-focus here exists so the
  // next person can be scanned without anyone tapping the screen first. While
  // the camera is open, though, focusing would pop the phone keyboard over the
  // viewfinder, so the camera wins.
  const focus = () => {
    if (!scanningRef.current) inputRef.current?.focus();
  };
  useEffect(focus, []);

  const check = useCallback(async (value) => {
    if (!value || busyRef.current) return;

    busyRef.current = true;
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
      busyRef.current = false;
      setBusy(false);
      focus();
    }
  }, []);

  function submit(e) {
    e?.preventDefault();
    check(code.trim());
  }

  // Camera scanning: decode QR frames with jsQR and push whatever the code
  // says through the same check-in path as typed input — the API already
  // normalises URLs and bare IDs alike. The camera stays open between guests
  // so the volunteer just points at the next phone in the queue; a short
  // per-code cooldown stops one pass from being submitted thirty times a
  // second while it's still in front of the lens.
  const videoRef = useRef(null);
  useEffect(() => {
    if (!scanning) return;

    let stream = null;
    let raf = 0;
    let cancelled = false;
    const lastSeen = { text: null, at: 0 };
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        if (!cancelled) {
          setScanning(false);
          setError("Camera unavailable. Allow camera access, or type the ID instead.");
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      inputRef.current?.blur();

      const tick = () => {
        if (cancelled) return;
        if (video.readyState >= 2 && !busyRef.current) {
          // Downscale before decoding — jsQR on a full 4K frame is what makes
          // "the scanner feels laggy" bug reports.
          const scale = Math.min(1, 640 / video.videoWidth || 1);
          canvas.width = Math.floor(video.videoWidth * scale);
          canvas.height = Math.floor(video.videoHeight * scale);
          if (canvas.width && canvas.height) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height, {
              inversionAttempts: "dontInvert",
            });
            const now = Date.now();
            if (
              found?.data &&
              !(found.data === lastSeen.text && now - lastSeen.at < 4000)
            ) {
              lastSeen.text = found.data;
              lastSeen.at = now;
              check(found.data);
            }
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [scanning, check]);

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

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setScanning((s) => !s);
        }}
        className={`glass-strong flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 font-display text-base font-black uppercase tracking-wider transition ${
          scanning ? "text-[#ff2ed1]" : "text-[#00f0ff]"
        }`}
      >
        {scanning ? (
          <>
            <CameraOff className="h-5 w-5" /> Stop camera
          </>
        ) : (
          <>
            <Camera className="h-5 w-5" /> Scan QR with camera
          </>
        )}
      </button>

      {scanning && (
        <div className="relative overflow-hidden rounded-2xl border border-white/15">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-64 w-full bg-black object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-xl border-2 border-[#00f0ff]/70" />
          </div>
          <p className="absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-center text-[11px] text-white/70">
            Point at the pass QR — it checks in automatically.
          </p>
        </div>
      )}

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
