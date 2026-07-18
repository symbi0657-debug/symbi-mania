"use client";

import { useEffect, useState } from "react";
import { DigitalPass } from "@/components/holo/DigitalPass";

export default function TicketPage({ params }) {
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/ticket/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setTicket(data.ticket);
      })
      .catch(() => setError("Could not load pass."));
  }, [params.id]);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-32 pb-16 text-center sm:px-6">
      {error && <p className="text-red-400">{error}</p>}
      {!ticket && !error && <p className="text-white/50">Loading your pass…</p>}
      {ticket && <DigitalPass ticket={ticket} />}
    </div>
  );
}
