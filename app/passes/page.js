import { PassTiers } from "@/components/holo/PassTiers";
import { HoloPill } from "@/components/holo/HoloPill";

export const metadata = {
  title: "Passes · Fresho Mania 3.0",
  description: "Pick your pass — Male, Female or Couple. Limited drop.",
  openGraph: {
    title: "Passes · Fresho Mania 3.0",
    description: "Male ₹500 · Female ₹400 · Couple ₹700. Limited drop.",
  },
};

export default function PassesPage() {
  return (
    <div className="pt-28">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <HoloPill className="mb-4">Limited drop</HoloPill>
        <h1 className="font-display text-holo text-5xl font-black tracking-tight sm:text-7xl">
          CHOOSE YOUR PASS
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
          One night. All fandom. Pick your tier and lock it in.
        </p>
      </div>
      <PassTiers />
    </div>
  );
}
