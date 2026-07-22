import { Hero } from "@/components/holo/Hero";
import { PassTiers } from "@/components/holo/PassTiers";
import { EventDetails } from "@/components/holo/EventDetails";
import { SocialProofTicker } from "@/components/holo/SocialProofTicker";

export default function Home() {
  return (
    <>
      <Hero />
      <div className="py-6">
        <SocialProofTicker />
      </div>
      <PassTiers />
      <EventDetails />
      <footer className="mx-auto max-w-6xl px-4 py-10 text-center text-xs text-white/40 sm:px-6">
        © 2026 Black Fox Entertainment Ent. · All rights reserved
      </footer>
    </>
  );
}
