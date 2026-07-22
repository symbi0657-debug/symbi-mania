"use client";

import { useEffect, useState } from "react";

function diff(target) {
  const d = Math.max(0, target - Date.now());
  return {
    days: Math.floor(d / 86400000),
    hours: Math.floor((d / 3600000) % 24),
    mins: Math.floor((d / 60000) % 60),
    secs: Math.floor((d / 1000) % 60),
  };
}

export function Countdown({ iso }) {
  const target = new Date(iso).getTime();
  const [t, setT] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setT(diff(target));
    const i = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(i);
  }, [target]);

  const cells = [
    ["DAYS", mounted ? t.days : 0],
    ["HRS", mounted ? t.hours : 0],
    ["MIN", mounted ? t.mins : 0],
    ["SEC", mounted ? t.secs : 0],
  ];
  return (
    <div className="flex gap-2 sm:gap-3" suppressHydrationWarning>
      {cells.map(([label, v]) => (
        <div
          key={label}
          className="glass min-w-[60px] rounded-xl px-3 py-2 text-center sm:min-w-[76px] sm:px-4 sm:py-3"
        >
          <div className="text-holo font-display text-2xl font-black tabular-nums sm:text-4xl" suppressHydrationWarning>
            {String(v).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[10px] tracking-[0.2em] text-white/60 sm:text-xs">{label}</div>
        </div>
      ))}
    </div>
  );
}
