"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

const messages = [
  "128 passes sold in the last hour",
  "Couple passes 82% booked",
  "Priya just grabbed a Female Pass",
  "Female tier — only 32 left",
  "Rahul & Ananya locked a Couple Pass",
];

export function SocialProofTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const int = setInterval(() => setI((v) => (v + 1) % messages.length), 3500);
    return () => clearInterval(int);
  }, []);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="glass flex items-center gap-3 overflow-hidden rounded-full px-4 py-2">
        <Flame className="h-4 w-4 shrink-0 text-[#ff2ed1]" />
        <div key={i} className="fade-in slide-up text-xs text-white/80 sm:text-sm">
          {messages[i]}
        </div>
      </div>
    </div>
  );
}
