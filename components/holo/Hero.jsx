"use client";

import Link from "next/link";
import { EVENT_CONFIG } from "@/lib/event-config";
import { HoloPill } from "./HoloPill";
import { HoloButton } from "./HoloButton";
import { Countdown } from "./Countdown";
import { HeroVideo } from "./HeroVideo";
import { Ticket } from "lucide-react";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden pt-24">
      <HeroVideo />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 text-center sm:px-6">
        <img
          src="/fresho-logo.png"
<<<<<<< HEAD
          alt="Fresho Mania 3.0 — Black Fox Entertainment"
=======
<<<<<<< HEAD
          alt="Fresho Mania 3.0 — Black Fox Entertainment"
=======
          alt="Symbi Fresho Mania 3.0 — Black Fox Entertainment"
>>>>>>> ca7f066851bbb3ddf5a079ac0fd3ae2b5589d67e
>>>>>>> 4249f22f8fafa34c8b1ddc488ddae4bb8270f874
          className="w-[92vw] max-w-[42rem] drop-shadow-[0_0_60px_rgba(255,46,209,0.45)] sm:max-w-[52rem] md:max-w-[64rem] lg:max-w-[72rem]"
        />

        <HoloPill>{EVENT_CONFIG.tagline}</HoloPill>

        <div className="mt-2">
<<<<<<< HEAD
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-white/50">Doors open in</p>
=======
<<<<<<< HEAD
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-white/50">Doors open in</p>
=======
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-white/50">
            Doors open in
          </p>
>>>>>>> ca7f066851bbb3ddf5a079ac0fd3ae2b5589d67e
>>>>>>> 4249f22f8fafa34c8b1ddc488ddae4bb8270f874
          <Countdown iso={EVENT_CONFIG.date} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <HoloButton asChild>
            <Link href="/passes">
              <Ticket className="h-4 w-4" /> Get My Pass
            </Link>
          </HoloButton>
          <HoloButton asChild variant="ghost">
            <Link href="/#details">Event Details</Link>
          </HoloButton>
        </div>

        <div className="mt-3">
          <HoloPill tone="hot">🔥 Pass Out Soon</HoloPill>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent"
        aria-hidden
      />
    </section>
  );
}
