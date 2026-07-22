"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { PASS_TIERS, MAX_QTY_PER_ORDER } from "@/lib/event-config";
import { saveTicket } from "@/lib/ticket-store";
import { HoloButton } from "@/components/holo/HoloButton";
import { HoloPill } from "@/components/holo/HoloPill";
import { DigitalPass } from "@/components/holo/DigitalPass";
import {
  Check,
  Minus,
  Plus,
  Loader2,
  Share2,
  Download,
  Clock,
  ShieldAlert,
  Lock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["Pass", "Details", "Pay", "Done"];

/**
 * Cashfree's browser SDK, loaded on demand rather than in the document head.
 * It is only needed by the one buyer in ten who reaches step 3, so making every
 * visitor pay for the script — including the ones who bounce off the hero — is
 * a worse trade than the ~300ms it costs at the moment of checkout.
 */
let sdkPromise = null;
function loadCashfreeSdk() {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.async = true;
    s.onload = () =>
      window.Cashfree
        ? resolve(window.Cashfree)
        : reject(new Error("Payment SDK loaded but did not initialise"));
    s.onerror = () => {
      // Clear the cached promise so a retry actually retries instead of
      // resolving the same rejection forever.
      sdkPromise = null;
      reject(new Error("Could not load the payment page. Check your connection."));
    };
    document.head.appendChild(s);
  });

  return sdkPromise;
}

function ProgressBar({ step }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-24 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        {STEP_LABELS.map((l, i) => {
          const n = i + 1;
          const active = step >= n;
          return (
            <div key={l} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition",
                  active ? "bg-holo text-black" : "glass text-white/60",
                )}
              >
                {step > n ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-[10px] uppercase tracking-widest",
                    active ? "text-white" : "text-white/40",
                  )}
                >
                  {l}
                </div>
                <div className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      "h-full transition-all",
                      active ? "bg-holo w-full" : "w-0",
                    )}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/60">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, error, type = "text", placeholder, hint, maxLength, digitsOnly }) {
  const [focus, setFocus] = useState(false);
  const handleChange = (raw) => {
    let v = digitsOnly ? raw.replace(/\D/g, "") : raw;
    if (maxLength) v = v.slice(0, maxLength);
    onChange(v);
  };
  return (
    <div className={cn(error && "animate-shake")}>
      <label className="text-[10px] uppercase tracking-widest text-white/50">
        {label}
      </label>
      <div
        className={cn(
          "mt-1 rounded-xl p-[1px] transition",
          focus ? "ring-holo" : "bg-white/10",
          error && "bg-gradient-to-r from-red-500/60 to-pink-500/60",
        )}
      >
        <input
          type={type}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={digitsOnly ? "numeric" : undefined}
          className="w-full rounded-xl bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
        />
      </div>
      {hint && !error && <div className="mt-1 text-[11px] text-white/40">{hint}</div>}
      {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
    </div>
  );
}

/** mm:ss left on the payment hold, or null once it's lapsed. */
function useCountdown(expiresAt) {
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (!expiresAt) {
      setLeft(null);
      return;
    }
    const target = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (left === null) return null;
  const total = Math.floor(left / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return { ms: left, label: `${mm}:${ss}`, expired: left <= 0 };
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const initialPass = searchParams.get("pass") || "male";
  const initialQty = Number(searchParams.get("qty")) || 1;
  // Set by Cashfree's return_url when the buyer comes back from the hosted
  // payment page. Its presence is the signal to go verify, never to trust.
  const returnRef = searchParams.get("order_ref");

  const [pass, setPassState] = useState(initialPass);
  const [qty, setQtyState] = useState(initialQty);
  const [step, setStep] = useState(returnRef ? 4 : 1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    partnerName: "",
    partnerPhone: "",
    college: "",
    referralCode: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState(null);
  const [order, setOrder] = useState(null);
  const [ticket, setTicket] = useState(null);
  // null → not returning from payment. "checking" | "failed" while we settle it.
  const [verifyState, setVerifyState] = useState(returnRef ? "checking" : null);
  const [verifyNote, setVerifyNote] = useState("");
  const passRef = useRef(null);

  const tier = useMemo(
    () => PASS_TIERS.find((p) => p.id === pass) || PASS_TIERS[0],
    [pass],
  );
  const listTotal = tier.price * qty;
  const countdown = useCountdown(order?.expiresAt);

  /* ── Live inventory ───────────────────────────────────────────────────── */

  useEffect(() => {
    let alive = true;
    fetch("/api/inventory")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.inventory) setInventory(data.inventory);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const stockFor = useCallback(
    (id) => (inventory ? inventory.find((i) => i.id === id) : null),
    [inventory],
  );

  /* ── Pass image ───────────────────────────────────────────────────────── */

  async function downloadPassImage() {
    if (!passRef.current) return;
    const node = passRef.current;
    const toastId = toast.loading("Preparing your pass image…");
    try {
      await document.fonts.ready;

      // background-clip:text elements render as solid gradient blocks in
      // html2canvas since it ignores the "clip to text" part. Swap them to
      // solid white text just for the capture, then restore afterward.
      const gradientEls = node.querySelectorAll(".text-holo");
      const restore = [];
      gradientEls.forEach((el) => {
        restore.push([
          el,
          el.style.webkitTextFillColor,
          el.style.color,
          el.style.backgroundImage,
        ]);
        el.style.webkitTextFillColor = "#ffffff";
        el.style.color = "#ffffff";
        el.style.backgroundImage = "none";
      });

      const canvas = await html2canvas(node, {
        backgroundColor: "#0a0518",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      restore.forEach(([el, fill, color, bg]) => {
        el.style.webkitTextFillColor = fill;
        el.style.color = color;
        el.style.backgroundImage = bg;
      });

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `fresho-mania-pass-${ticket?.id || "ticket"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Pass saved to device", { id: toastId });
    } catch (err) {
      toast.error("Couldn't generate image. Try a screenshot instead.", {
        id: toastId,
      });
    }
  }

  function shareOnWhatsApp() {
    const msg = `I got my pass for FRESHO Mania 3.0 🔥 Pass ID: ${ticket.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  /* ── Selection ────────────────────────────────────────────────────────── */

  const setQty = (n) =>
    setQtyState(Math.max(1, Math.min(MAX_QTY_PER_ORDER, n)));

  function setPass(id) {
    setPassState(id);
    setQtyState(1);
  }

  function validate() {
    const e = {};
    if (form.name.trim().length < 2) e.name = "Enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Invalid email";
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, "").slice(-10)))
      e.phone = "10-digit Indian mobile";
    if (pass === "couple") {
      if (form.partnerName.trim().length < 2)
        e.partnerName = "Partner name required";
      if (!/^[6-9]\d{9}$/.test(form.partnerPhone.replace(/\D/g, "").slice(-10)))
        e.partnerPhone = "10-digit Indian mobile";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const orderSignature = [
    pass,
    qty,
    form.name.trim(),
    form.email.trim().toLowerCase(),
    form.phone.replace(/\D/g, ""),
    form.referralCode.trim(),
  ].join("|");

  async function createOrder() {
    if (!validate()) {
      toast.error("Fix the highlighted fields");
      return;
    }
    if (
      order &&
      order.signature === orderSignature &&
      new Date(order.expiresAt).getTime() > Date.now()
    ) {
      setStep(3);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass, qty, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create order");

      setOrder({ ...data, signature: orderSignature });
      setStep(3);

      if (form.referralCode.trim()) {
        if (data.referralApplied)
          toast.success(`Referral applied — ₹${data.discount} off`);
        else toast.info("That referral code isn't valid, so it wasn't applied.");
      }

      // A 100% referral discount leaves nothing to charge, so the server has
      // already confirmed it and there is no gateway leg at all.
      if (data.free) {
        if (data.paid) {
          toast.success("Nothing to pay — your pass is on its way.");
          window.location.href = `/checkout?order_ref=${data.orderRef}`;
        } else {
          // Nothing to pay but we couldn't confirm it — there is no payment
          // page to fall back to, so say so rather than showing a dead button.
          toast.error(
            `Couldn't issue your free pass. Quote ${data.orderRef} to the organizers.`,
          );
        }
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Hand off to Cashfree ─────────────────────────────────────────────── */

  async function payNow() {
    if (!order?.paymentSessionId) return;
    setLoading(true);
    try {
      const Cashfree = await loadCashfreeSdk();
      const cashfree = Cashfree({ mode: order.cashfreeMode || "sandbox" });

      // "_self" — a full-page redirect rather than a modal. On mobile browsers
      // a UPI app switch routinely kills the opener, and a modal that dies takes
      // the payment result with it; a redirect survives because Cashfree brings
      // the buyer back to our return_url regardless of what happened in between.
      const result = await cashfree.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: "_self",
      });

      // Reached only if the SDK declined to navigate at all.
      if (result?.error) {
        throw new Error(result.error.message || "Could not open the payment page");
      }
    } catch (err) {
      toast.error(err.message || "Could not open the payment page. Try again.");
      setLoading(false);
    }
  }

  /* ── Settle the payment after Cashfree redirects back ─────────────────── */

  useEffect(() => {
    if (!returnRef) return;

    let alive = true;
    let attempts = 0;

    async function settle() {
      attempts += 1;
      try {
        const res = await fetch(`/api/orders/${returnRef}/verify`, {
          method: "POST",
          cache: "no-store",
        });
        const data = await res.json();
        if (!alive) return true;

        if (data.paid && data.passUrl) {
          // The verify response deliberately carries no QR and no contact
          // details. Fetch the pass itself through the signed route, which is
          // the only path that hands out a scannable credential.
          let full = null;
          try {
            const passRes = await fetch(
              `/api/ticket/${data.id}?${data.passUrl.split("?")[1] || ""}`,
              { cache: "no-store" },
            );
            if (passRes.ok) full = (await passRes.json()).ticket;
          } catch {
            // Falls through — the emailed copy still carries the QR.
          }

          const confirmed = {
            id: data.id,
            orderRef: data.orderRef,
            status: "paid",
            passName: data.passName,
            quantity: data.quantity,
            entries: data.entries,
            total: data.total,
            name: full?.name || "",
            qrDataUrl: full?.qrDataUrl || null,
            passUrl: data.passUrl,
            checkedInAt: full?.checkedInAt || null,
          };
          saveTicket(confirmed);
          setTicket(confirmed);
          setVerifyState(null);
          toast.success("Payment confirmed. See you on the floor.");
          return true;
        }

        /*
         * Not paid yet. Cashfree reports ACTIVE while a payment is still being
         * settled — common with UPI, where the buyer may still be approving in
         * their bank app — so keep polling for a bit before calling it failed.
         */
        if (data.orderStatus === "ACTIVE" && attempts < 12) return false;

        setVerifyState("failed");
        /*
         * Three genuinely different situations, and telling them apart matters
         * because only one of them means "no money moved". Promising an
         * automatic refund to someone whose payment WAS captured — the mismatch
         * case — is a lie that turns a fixable problem into a chargeback.
         */
        if (data.reason === "amount_mismatch") {
          setVerifyNote(
            "Your payment went through, but the amount doesn't match this order, so we've held it for a human to check rather than issuing a pass automatically. Nothing further is needed from you — contact the organizers with your order reference and they'll either issue the pass or refund you.",
          );
        } else if (data.orderStatus === "EXPIRED" || data.status === "expired") {
          setVerifyNote(
            "This order expired before the payment completed, and its seats went back on sale. If money did leave your account, contact the organizers with your order reference.",
          );
        } else {
          setVerifyNote(
            "We couldn't confirm a payment for this order. If no money left your account, nothing has been charged and you can start again. If it did, contact the organizers with your order reference and they'll sort it out.",
          );
        }
        return true;
      } catch {
        // A dropped poll is harmless; the next tick retries.
        if (attempts >= 12) {
          setVerifyState("failed");
          setVerifyNote(
            "We couldn't reach our servers to confirm your payment. Your pass will still be emailed if it went through.",
          );
          return true;
        }
        return false;
      }
    }

    let timer;
    (async function loop() {
      const done = await settle();
      if (!done && alive) timer = setTimeout(loop, 3000);
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [returnRef]);

  return (
    <>
      <ProgressBar step={step} />

      <div className="mx-auto max-w-2xl px-4 pb-32 sm:px-6">
        {step === 1 && (
          <div className="fade-in slide-up">
            <h1 className="font-display text-holo mb-6 text-3xl font-black">
              Choose your pass
            </h1>
            <div className="space-y-3">
              {PASS_TIERS.map((t) => {
                const selected = t.id === pass;
                const stock = stockFor(t.id);
                const soldOut = Boolean(stock) && stock.left <= 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => !soldOut && setPass(t.id)}
                    disabled={soldOut}
                    className={cn(
                      "w-full rounded-2xl p-[1px] text-left transition",
                      selected && !soldOut ? "ring-holo" : "bg-white/10",
                      soldOut && "cursor-not-allowed opacity-50 grayscale",
                    )}
                  >
                    <div className="glass-strong flex items-center gap-4 rounded-2xl p-4">
                      <div
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2",
                          selected && !soldOut
                            ? "border-[#00f0ff] bg-[#00f0ff]/20"
                            : "border-white/30",
                        )}
                      >
                        {selected && !soldOut && (
                          <div className="h-2 w-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-white">
                            {t.name}
                          </div>
                          {soldOut ? (
                            <HoloPill>Sold out</HoloPill>
                          ) : (
                            t.badge && <HoloPill tone="hot">{t.badge}</HoloPill>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-white/50">
                          {t.entries} entry ·{" "}
                          {stock ? `${stock.left} left` : "checking…"}
                        </div>
                      </div>
                      <div className="text-holo font-display text-2xl font-black">
                        ₹{t.price}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="glass-strong mt-6 flex items-center justify-between rounded-2xl p-4">
              <span className="text-sm text-white/70">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(qty - 1)}
                  className="glass grid h-9 w-9 place-items-center rounded-full"
                  aria-label="Decrease"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-holo font-display w-6 text-center text-xl font-black">
                  {qty}
                </span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="glass grid h-9 w-9 place-items-center rounded-full"
                  aria-label="Increase"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fade-in slide-up space-y-4">
            <h1 className="font-display text-holo mb-2 text-3xl font-black">
              Attendee details
            </h1>
            <Field
              label="Full name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              error={errors.name}
              placeholder="As per ID"
              maxLength={60}
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              error={errors.email}
              placeholder="you@college.edu"
              hint="Your pass is emailed here the moment payment succeeds."
              maxLength={100}
            />
            <Field
              label="Phone (+91)"
              type="tel"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              error={errors.phone}
              placeholder="98765 43210"
              maxLength={10}
              digitsOnly
            />
            {pass === "couple" && (
              <>
                <Field
                  label="Partner name"
                  value={form.partnerName}
                  onChange={(v) => setForm((f) => ({ ...f, partnerName: v }))}
                  error={errors.partnerName}
                  maxLength={60}
                />
                <Field
                  label="Partner phone"
                  type="tel"
                  value={form.partnerPhone}
                  onChange={(v) => setForm((f) => ({ ...f, partnerPhone: v }))}
                  error={errors.partnerPhone}
                  maxLength={10}
                  digitsOnly
                />
              </>
            )}
            <Field
              label="College / Course (optional)"
              value={form.college}
              onChange={(v) => setForm((f) => ({ ...f, college: v }))}
              maxLength={80}
            />
            <Field
              label="Referral code (optional)"
              value={form.referralCode}
              onChange={(v) =>
                setForm((f) => ({ ...f, referralCode: v.toUpperCase() }))
              }
              placeholder="e.g. RIYA24"
              hint="Got a code from a promoter? We'll apply the discount on the next step."
              maxLength={16}
            />
          </div>
        )}

        {step === 3 && order && (
          <div className="fade-in slide-up">
            <h1 className="font-display text-holo mb-1 text-3xl font-black">
              Confirm and pay
            </h1>
            <p className="mb-5 text-sm text-white/60">
              You'll be taken to Cashfree's secure page to pay by UPI, card, or
              netbanking, then brought straight back here.
            </p>

            <div className="glass-strong space-y-4 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50">
                    Amount to pay
                  </div>
                  <div className="text-holo font-display text-3xl font-black">
                    ₹{order.total}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-white/50">
                    Hold expires in
                  </div>
                  <div
                    className={cn(
                      "font-display flex items-center justify-end gap-1.5 text-2xl font-black",
                      countdown?.expired ? "text-red-400" : "text-white",
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    {countdown ? countdown.label : "--:--"}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10" />

              <Row label="Pass" value={`${tier.name} × ${qty}`} />
              {order.discount > 0 && (
                <>
                  <Row label="Subtotal" value={`₹${order.subtotal}`} />
                  <Row
                    label={`Referral discount${
                      form.referralCode ? ` (${form.referralCode})` : ""
                    }`}
                    value={`− ₹${order.discount}`}
                  />
                </>
              )}
              <Row label="Order reference" value={order.orderRef} />

              <div className="border-t border-white/10" />

              <HoloButton
                onClick={payNow}
                disabled={loading || countdown?.expired}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Opening secure
                    checkout
                  </>
                ) : countdown?.expired ? (
                  <>Hold expired — start again</>
                ) : (
                  <>
                    <Lock className="h-4 w-4" /> Pay ₹{order.total} securely
                  </>
                )}
              </HoloButton>

              <p className="text-center text-[11px] leading-relaxed text-white/40">
                Payments are processed by Cashfree. We never see your card or UPI
                credentials. Your pass is issued automatically the moment the
                payment succeeds.
              </p>
            </div>
          </div>
        )}

        {/* Step 4 while settling: the buyer has come back from Cashfree and we
            are asking Cashfree, not the buyer, what actually happened. */}
        {step === 4 && verifyState === "checking" && (
          <div className="fade-in slide-up text-center">
            <div className="relative mx-auto mb-6 h-20 w-20">
              <div className="animate-pulse-glow absolute inset-0 rounded-full bg-amber-400/40 blur-xl" />
              <div className="glass-strong relative grid h-full w-full place-items-center rounded-full">
                <Loader2 className="h-9 w-9 animate-spin text-amber-300" />
              </div>
            </div>
            <HoloPill className="mb-4">Confirming payment</HoloPill>
            <h1 className="font-display text-3xl font-black text-white">
              Hang on a moment
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
              We're confirming your payment with Cashfree. This usually takes a
              few seconds — don't close this page or press back.
            </p>
            <p className="mt-4 text-[11px] text-white/40">
              Order reference: <span className="text-white/70">{returnRef}</span>
            </p>
          </div>
        )}

        {step === 4 && verifyState === "failed" && (
          <div className="fade-in slide-up text-center">
            <div className="glass-strong mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full">
              <ShieldAlert className="h-9 w-9 text-amber-300" />
            </div>
            <h1 className="font-display text-3xl font-black text-white">
              Payment not confirmed
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
              {verifyNote}
            </p>

            <div className="glass-strong mt-6 space-y-3 rounded-2xl p-5 text-left">
              <Row label="Order reference" value={returnRef} />
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <HoloButton
                onClick={() => {
                  setVerifyState("checking");
                  // Remount the settle effect by reloading with the same ref.
                  window.location.reload();
                }}
              >
                <RefreshCw className="h-4 w-4" /> Check again
              </HoloButton>
              <HoloButton asChild variant="ghost">
                <a href="/checkout">Start a new order</a>
              </HoloButton>
            </div>
          </div>
        )}

        {step === 4 && !verifyState && ticket && (
          <div className="fade-in zoom-in text-center">
            <div className="relative mx-auto mb-6 h-20 w-20">
              <div className="animate-pulse-glow bg-holo absolute inset-0 rounded-full opacity-60 blur-xl" />
              <div className="bg-holo relative grid h-full w-full place-items-center rounded-full">
                <Check className="h-10 w-10 text-black" strokeWidth={3} />
              </div>
            </div>
            <h1 className="font-display text-holo text-4xl font-black">
              You're in.
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Payment confirmed and your pass is on its way by email. Screenshot
              the ticket below.
            </p>
            <div className="mt-8">
              <DigitalPass ticket={ticket} ref={passRef} />
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <HoloButton onClick={downloadPassImage}>
                <Download className="h-4 w-4" /> Download Pass
              </HoloButton>
              <HoloButton
                variant="ghost"
                onClick={async () => {
                  await downloadPassImage();
                  toast.info("Pass image downloaded — attach it in WhatsApp");
                  setTimeout(shareOnWhatsApp, 800);
                }}
              >
                <Share2 className="h-4 w-4" /> Share on WhatsApp
              </HoloButton>
            </div>
          </div>
        )}
      </div>

      {step < 3 && (
        <div className="fixed inset-x-0 bottom-0 z-30 md:bottom-0">
          <div className="glass-strong mx-3 mb-24 flex items-center justify-between gap-4 rounded-2xl p-4 md:mx-auto md:mb-6 md:max-w-2xl">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                Total
              </div>
              <div className="text-holo font-display text-2xl font-black">
                ₹{order ? order.total : listTotal}
              </div>
            </div>
            <div className="flex gap-2">
              {step > 1 && (
                <HoloButton
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={loading}
                >
                  Back
                </HoloButton>
              )}
              {step === 1 && (
                <HoloButton onClick={() => setStep(2)}>Continue</HoloButton>
              )}
              {step === 2 && (
                <HoloButton onClick={createOrder} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating
                    </>
                  ) : (
                    <>Continue to payment</>
                  )}
                </HoloButton>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={<div className="pt-32 text-center text-white/50">Loading…</div>}
    >
      <CheckoutInner />
    </Suspense>
  );
}
