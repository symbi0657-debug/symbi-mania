"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { PASS_TIERS } from "@/lib/event-config";
import { saveTicket } from "@/lib/ticket-store";
import { HoloButton } from "@/components/holo/HoloButton";
import { HoloPill } from "@/components/holo/HoloPill";
import { DigitalPass } from "@/components/holo/DigitalPass";
import { Check, Minus, Plus, Loader2, Share2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

function ProgressBar({ step }) {
  const labels = ["Pass", "Details", "Payment", "Done"];
  return (
    <div className="mx-auto max-w-2xl px-4 pt-24 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        {labels.map((l, i) => {
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

function Field({ label, value, onChange, error, type = "text", placeholder }) {
  const [focus, setFocus] = useState(false);
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
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          className="w-full rounded-xl bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
        />
      </div>
      {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
    </div>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPass = searchParams.get("pass") || "male";
  const initialQty = Number(searchParams.get("qty")) || 1;

  const [pass, setPassState] = useState(initialPass);
  const [qty, setQtyState] = useState(initialQty);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    partnerName: "",
    partnerPhone: "",
    college: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const passRef = useRef(null);

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

  const tier = useMemo(() => PASS_TIERS.find((p) => p.id === pass), [pass]);
  const total = tier.price * qty;

  function updateParams(next) {
    if (next.qty !== undefined)
      setQtyState(Math.max(1, Math.min(10, next.qty)));
    if (next.pass !== undefined) {
      setPassState(next.pass);
      setQtyState(1);
    }
  }

  const setQty = (n) => updateParams({ qty: Math.max(1, Math.min(10, n)) });
  const setPass = (id) => updateParams({ pass: id, qty: 1 });

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
        e.partnerPhone = "Partner mobile required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function pay() {
    setLoading(true);
    try {
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pass,
          qty,
          name: form.name,
          email: form.email,
          phone: form.phone,
        }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok)
        throw new Error(order.error || "Could not create order");

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "SYMBI FRESHO Mania 3.0",
        description: `${tier.name} × ${qty}`,
        prefill: { name: form.name, email: form.email, contact: form.phone },
        theme: { color: "#ff2ed1" },
        handler: async function (response) {
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                pass,
                qty,
                ...form,
              }),
            });
            const result = await verifyRes.json();
            if (!verifyRes.ok)
              throw new Error(result.error || "Verification failed");
            saveTicket(result.ticket);
            setTicket(result.ticket);
            setStep(4);
            toast.success("Pass confirmed. See you on the floor.");
          } catch (err) {
            toast.error(
              "Payment succeeded but pass generation failed. Contact support with payment ID: " +
                response.razorpay_payment_id,
            );
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      });

      rzp.on("payment.failed", function (resp) {
        toast.error("Payment failed: " + resp.error.description);
        setLoading(false);
      });

      rzp.open();
    } catch (err) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
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
                return (
                  <button
                    key={t.id}
                    onClick={() => setPass(t.id)}
                    className={cn(
                      "w-full rounded-2xl p-[1px] text-left transition",
                      selected ? "ring-holo" : "bg-white/10",
                    )}
                  >
                    <div className="glass-strong flex items-center gap-4 rounded-2xl p-4">
                      <div
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2",
                          selected
                            ? "border-[#00f0ff] bg-[#00f0ff]/20"
                            : "border-white/30",
                        )}
                      >
                        {selected && (
                          <div className="h-2 w-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-white">
                            {t.name}
                          </div>
                          {t.badge && <HoloPill tone="hot">{t.badge}</HoloPill>}
                        </div>
                        <div className="mt-0.5 text-xs text-white/50">
                          {t.entries} entry · {t.left} left
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
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              error={errors.email}
              placeholder="you@college.edu"
            />
            <Field
              label="Phone (+91)"
              type="tel"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              error={errors.phone}
              placeholder="98765 43210"
            />
            {pass === "couple" && (
              <>
                <Field
                  label="Partner name"
                  value={form.partnerName}
                  onChange={(v) => setForm((f) => ({ ...f, partnerName: v }))}
                  error={errors.partnerName}
                />
                <Field
                  label="Partner phone"
                  type="tel"
                  value={form.partnerPhone}
                  onChange={(v) => setForm((f) => ({ ...f, partnerPhone: v }))}
                  error={errors.partnerPhone}
                />
              </>
            )}
            <Field
              label="College / Course (optional)"
              value={form.college}
              onChange={(v) => setForm((f) => ({ ...f, college: v }))}
            />
          </div>
        )}

        {step === 3 && (
          <div className="fade-in slide-up">
            <h1 className="font-display text-holo mb-4 text-3xl font-black">
              Confirm & pay
            </h1>
            <div className="glass-strong space-y-3 rounded-2xl p-5">
              <Row label="Pass" value={`${tier.name} × ${qty}`} />
              <Row label="Attendee" value={form.name} />
              <Row label="Phone" value={form.phone} />
              <div className="border-t border-white/10" />
              <Row label="Subtotal" value={`₹${total}`} />
              <Row label="Convenience" value="₹0" />
              <div className="border-t border-white/10" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/60">Total</span>
                <span className="text-holo font-display text-3xl font-black">
                  ₹{total}
                </span>
              </div>
            </div>
            <p className="mt-4 text-center text-[11px] text-white/40">
              UPI · Cards · Netbanking · Wallets · via Razorpay
            </p>
          </div>
        )}

        {step === 4 && ticket && (
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
              Pass sent to {ticket.email}. Screenshot the ticket below.
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
                onClick={() => {
                  const msg = `I got my pass for SYMBI FRESHO Mania 3.0 🔥 Pass ID: ${ticket.id}`;
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(msg)}`,
                    "_blank",
                  );
                }}
              >
                <Share2 className="h-4 w-4" /> Share on WhatsApp
              </HoloButton>
            </div>
          </div>
        )}
      </div>

      {step < 4 && (
        <div className="fixed inset-x-0 bottom-0 z-30 md:bottom-0">
          <div className="glass-strong mx-3 mb-24 flex items-center justify-between gap-4 rounded-2xl p-4 md:mx-auto md:mb-6 md:max-w-2xl">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                Total
              </div>
              <div className="text-holo font-display text-2xl font-black">
                ₹{total}
              </div>
            </div>
            <div className="flex gap-2">
              {step > 1 && (
                <HoloButton
                  variant="ghost"
                  onClick={async () => {
                    await downloadPassImage();
                    toast.info("Pass image downloaded — attach it in WhatsApp");
                    setTimeout(() => {
                      const msg = `I got my pass for SYMBI FRESHO Mania 3.0 🔥 Pass ID: ${ticket.id}`;
                      window.open(
                        `https://wa.me/?text=${encodeURIComponent(msg)}`,
                        "_blank",
                      );
                    }, 800);
                  }}
                >
                  <Share2 className="h-4 w-4" /> Share on WhatsApp
                </HoloButton>
              )}
              {step === 1 && (
                <HoloButton onClick={() => setStep(2)}>Continue</HoloButton>
              )}
              {step === 2 && (
                <HoloButton
                  onClick={() => {
                    if (validate()) setStep(3);
                    else toast.error("Fix the highlighted fields");
                  }}
                >
                  Continue
                </HoloButton>
              )}
              {step === 3 && (
                <HoloButton onClick={pay} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing
                    </>
                  ) : (
                    <>Pay ₹{total} & Confirm</>
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
