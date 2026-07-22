"use client";

import { useState } from "react";
import { DigitalPass } from "@/components/holo/DigitalPass";
import { HoloButton } from "@/components/holo/HoloButton";
import { HoloPill } from "@/components/holo/HoloPill";
import { ScanLine, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/*
 * Lookup now has three outcomes rather than one, because the API no longer
 * hands over a stranger's pass to whoever types their phone number:
 *   ticket  → a Pass ID was supplied, so the pass renders here
 *   emailed → an email was supplied, so the pass was re-sent to it
 *   phone   → we can only confirm a pass exists, not display it
 */
export default function MyTicketPage() {
  const [query, setQuery] = useState("");
  const [ticket, setTicket] = useState(null);
  const [notice, setNotice] = useState(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setSearched(true);
    setTicket(null);
    setNotice(null);

    try {
      const res = await fetch("/api/lookup-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "No pass found");
        return;
      }

      if (data.mode === "ticket") {
        setTicket(data.ticket);
      } else {
        setNotice({ mode: data.mode, message: data.message, found: data.found });
        if (data.mode === "emailed") toast.success("Check your inbox");
      }
    } catch {
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
          Enter your Pass ID to see your pass, or your email address to have it
          re-sent.
        </p>
      </div>

      <div className="ring-holo mt-8 rounded-2xl p-[1px]">
        <div className="glass-strong flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="FM3-XXXX-XXXX or your email"
            autoComplete="off"
            className="flex-1 rounded-xl bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
          />
          <HoloButton onClick={search} disabled={loading}>
            {loading ? "Searching…" : "Find Pass"}
          </HoloButton>
        </div>
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/40">
        <ShieldCheck className="h-3 w-3 shrink-0" />
        We never show a pass from just a phone number — that would let anyone
        pull up yours.
      </p>

      {ticket && (
        <div className="mt-10">
          <DigitalPass ticket={ticket} />
        </div>
      )}

      {notice && (
        <div className="glass mt-10 rounded-2xl p-8 text-center">
          <Mail className="mx-auto mb-3 h-6 w-6 text-[#00f0ff]" />
          <p className="text-sm text-white/70">{notice.message}</p>
        </div>
      )}

      {searched && !ticket && !notice && !loading && (
        <div className="glass mt-10 rounded-2xl p-8 text-center text-sm text-white/60">
          Nothing here yet. Bought a pass? Use the exact Pass ID or email from
          your confirmation.
        </div>
      )}
    </div>
  );
}
