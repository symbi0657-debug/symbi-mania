"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DigitalPass } from "@/components/holo/DigitalPass";
import { HoloButton } from "@/components/holo/HoloButton";

/*
 * The page a QR scan lands on. The signature travels in `?t=` and must be
 * forwarded to the API — without it the lookup 404s by design, so pass IDs
 * can't be enumerated by anyone who works out the format.
 */
function TicketView({ id }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/ticket/${encodeURIComponent(id)}${qs}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setTicket(data.ticket);
      })
      .catch(() => setError("Could not load this pass. Check your connection."));
  }, [id, token]);

  if (error) {
    return (
      <div className="glass mx-auto max-w-md rounded-2xl p-8">
        <p className="font-semibold text-red-400">{error}</p>
        <p className="mt-2 text-sm text-white/60">
          Passes open from the link in your confirmation email. If you typed
          this address by hand, the signature will be missing.
        </p>
        <div className="mt-6">
          <HoloButton asChild>
            <Link href="/my-ticket">Find my pass</Link>
          </HoloButton>
        </div>
      </div>
    );
  }

  if (!ticket) return <p className="text-white/50">Loading your pass…</p>;

  return (
    <>
      <DigitalPass ticket={ticket} />
      {ticket.status !== "paid" && (
        <p className="mx-auto mt-6 max-w-sm text-sm text-[#ffb020]">
          This order hasn't been verified yet, so it won't admit you at the
          gate. You'll get an email the moment it's confirmed.
        </p>
      )}
    </>
  );
}

export default function TicketPage({ params }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-32 pb-16 text-center sm:px-6">
      <Suspense fallback={<p className="text-white/50">Loading your pass…</p>}>
        <TicketView id={params.id} />
      </Suspense>
    </div>
  );
}
