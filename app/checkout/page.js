"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PASS_TIERS } from "@/lib/event-config";
import { HoloButton } from "@/components/holo/HoloButton";
import { HoloPill } from "@/components/holo/HoloPill";
import { Check, Minus, Plus, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

// TODO: paste your Google Form embed URL here (must end in ?embedded=true)
const GOOGLE_FORM_URL = "https://forms.gle/kiqcezN8DMJso3L18";

function ProgressBar({ step }) {
  const labels = ["Pass", "Payment", "Done"];
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

function CheckoutInner() {
  const searchParams = useSearchParams();
  const initialPass = searchParams.get("pass") || "male";
  const initialQty = Number(searchParams.get("qty")) || 1;

  const [pass, setPassState] = useState(initialPass);
  const [qty, setQtyState] = useState(initialQty);
  const [step, setStep] = useState(1);

  const tier = useMemo(() => PASS_TIERS.find((p) => p.id === pass), [pass]);
  const total = tier.price * qty;

  const setQty = (n) => setQtyState(Math.max(1, Math.min(10, n)));
  const setPass = (id) => {
    setPassState(id);
    setQtyState(1);
  };

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
          <div className="fade-in slide-up space-y-6">
            <h1 className="font-display text-holo mb-2 text-3xl font-black">
              Pay & submit details
            </h1>

            <div className="glass-strong rounded-2xl p-5 text-center">
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                Amount to pay
              </div>
              <div className="text-holo font-display mt-1 text-4xl font-black">
                ₹{total}
              </div>
              <div className="mt-1 text-xs text-white/50">
                {tier.name} × {qty}
              </div>
            </div>

            <div className="glass-strong rounded-2xl p-5 text-center">
              <div className="mb-3 text-sm text-white/70">
                Scan & pay via UPI
              </div>
              <img
                src="/upi-qr.jpeg"
                alt="UPI QR code"
                className="mx-auto h-56 w-56 rounded-xl border border-white/10"
              />
              <p className="mt-3 text-sm text-white">
                After paying, fill the form below with your transaction ID and
                screenshot.
              </p>
            </div>

            <div className="glass-strong rounded-2xl p-6 text-center">
              <p className="mb-4 text-sm text-white">
                Tap below to open the payment confirmation form in a new tab.
                You'll need to sign in with a Google account to upload your
                screenshot.
              </p>
              <a href={GOOGLE_FORM_URL} target="_blank" rel="noreferrer">
                <HoloButton className="w-full">Fill Payment Form</HoloButton>
              </a>
            </div>

            <div className="glass-strong flex items-start gap-3 rounded-2xl p-4">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#00f0ff]" />
              <p className="text-sm text-white">
                After you submit the form, we'll verify your payment manually
                and email your ticket to the address you provided — usually
                within 24-48 hours . Please also check your{" "}
                <span className="font-semibold text-white">spam folder</span> if
                you don't see it.
              </p>
            </div>

            <HoloButton onClick={() => setStep(3)} className="w-full">
              I've submitted the form
            </HoloButton>
          </div>
        )}

        {step === 3 && (
          <div className="fade-in zoom-in text-center">
            <div className="relative mx-auto mb-6 h-20 w-20">
              <div className="animate-pulse-glow bg-holo absolute inset-0 rounded-full opacity-60 blur-xl" />
              <div className="bg-holo relative grid h-full w-full place-items-center rounded-full">
                <Check className="h-10 w-10 text-black" strokeWidth={3} />
              </div>
            </div>
            <h1 className="font-display text-holo text-4xl font-black">
              Almost there!
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-white/60">
              We've received your submission. Once your payment is verified,
              your ticket will be emailed to you. Please check your{" "}
              <span className="font-semibold text-white">spam/junk folder</span>{" "}
              if it doesn't arrive in your inbox.
            </p>
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
                ₹{total}
              </div>
            </div>
            <div className="flex gap-2">
              {step > 1 && (
                <HoloButton
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </HoloButton>
              )}
              {step === 1 && (
                <HoloButton onClick={() => setStep(2)}>Continue</HoloButton>
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
