"use client";

import { useState } from "react";
import { DigitalPass } from "@/components/holo/DigitalPass";
import { HoloButton } from "@/components/holo/HoloButton";
import { HoloPill } from "@/components/holo/HoloPill";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

export default function MyTicketPage() {
  const [query, setQuery] = useState("");
  const [ticket, setTicket] = useState(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/lookup-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTicket(null);
        toast.error(data.error || "No pass found for that phone / email / ID");
      } else {
        setTicket(data.ticket);
      }
    } catch {
      setTicket(null);
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-28 pb-16 sm:px-6">
      <div className="text-center">
        <HoloPill className="mb-4">
          <ScanLine className="h-3 w-3" /> Lookup
        </HoloPill>
        <h1 className="font-display text-holo text-5xl font-black tracking-tight sm:text-6xl">
          MY TICKET
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
          Find your pass using the phone number, email, or Pass ID you used at checkout.
        </p>
      </div>

      <div className="ring-holo mt-8 rounded-2xl p-[1px]">
        <div className="glass-strong flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Phone / email / Pass ID"
            className="flex-1 rounded-xl bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
          />
          <HoloButton onClick={search} disabled={loading}>
            {loading ? "Searching…" : "Find Pass"}
          </HoloButton>
        </div>
      </div>

      {ticket && (
        <div className="mt-10">
          <DigitalPass ticket={ticket} />
        </div>
      )}

      {searched && !ticket && !loading && (
        <div className="glass mt-10 rounded-2xl p-8 text-center text-sm text-white/60">
          Nothing here yet. Bought a pass? Try the exact phone or email you used.
        </div>
      )}
    </div>
  );
}
