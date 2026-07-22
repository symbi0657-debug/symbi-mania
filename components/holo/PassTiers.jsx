"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PASS_TIERS } from "@/lib/event-config";
import { HoloPill } from "./HoloPill";
import { HoloButton } from "./HoloButton";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

function Availability({ stock }) {
  // Fixed height in every state so the card never reflows when the live
  // numbers land.
  if (!stock)
    return (
      <span className="text-xs text-white/30">Checking availability…</span>
    );
  if (stock.left <= 0)
    return <span className="text-xs font-semibold text-white/50">Sold out</span>;
  return (
    <span className="text-xs text-white/50">
      <span className="text-[#ff2ed1]">{stock.left}</span>{" "}
      {stock.left === 1 ? "entry" : "entries"} left
    </span>
  );
}

function Card({ tier, stock }) {
  const soldOut = Boolean(stock) && stock.left <= 0;

  return (
    <div
      className={cn(
        "ring-holo group relative rounded-2xl p-[1px]",
        soldOut && "opacity-50 grayscale"
      )}
    >
      <div className="glass-strong flex h-full flex-col gap-5 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              {tier.entries} {tier.entries > 1 ? "Entries" : "Entry"}
            </div>
            <h3 className="mt-1 text-xl font-bold text-white">{tier.name}</h3>
          </div>
          {soldOut ? (
            <HoloPill>Sold out</HoloPill>
          ) : (
            tier.badge && (
              <HoloPill tone="hot">
                <Sparkles className="h-3 w-3" /> {tier.badge}
              </HoloPill>
            )
          )}
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-holo font-display text-5xl font-black">₹{tier.price}</span>
        </div>

        <ul className="space-y-2 text-sm text-white/70">
          {tier.perks.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              {p}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex h-9 items-center justify-between border-t border-white/10 pt-4">
          <Availability stock={stock} />
          {soldOut ? (
            <HoloButton
              variant="ghost"
              className="cursor-not-allowed px-5 py-2 text-xs"
              disabled
            >
              Sold out
            </HoloButton>
          ) : (
            <HoloButton asChild className="px-5 py-2 text-xs">
              <Link href={`/checkout?pass=${tier.id}&qty=1`}>Select</Link>
            </HoloButton>
          )}
        </div>
      </div>
    </div>
  );
}

export function PassTiers() {
  const [inventory, setInventory] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/inventory")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.inventory) setInventory(data.inventory);
      })
      .catch(() => {
        // Availability is a nicety; a failed fetch leaves the cards in their
        // neutral "checking" state rather than blocking the sale.
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="passes" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-10 text-center">
        <HoloPill className="mb-4">Pick your pass</HoloPill>
        <h2 className="font-display text-holo text-4xl font-black tracking-tight sm:text-5xl">
          THE PASSES
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
          Limited drop. All fandom. One night. Choose your entry.
        </p>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {PASS_TIERS.map((t) => (
          <div key={t.id} className="min-w-[85%] snap-center sm:min-w-0">
            <Card
              tier={t}
              stock={inventory ? inventory.find((i) => i.id === t.id) : null}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
