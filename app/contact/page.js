import { EVENT_CONFIG } from "@/lib/event-config";
import { EventDetails } from "@/components/holo/EventDetails";
import { HoloPill } from "@/components/holo/HoloPill";
import { MessageCircle, Phone } from "lucide-react";

export const metadata = {
  title: "Contact · Fresho Mania 3.0",
  description: "WhatsApp or call the Black Fox Entertainment team.",
  openGraph: {
    title: "Contact · Fresho Mania 3.0",
    description: "WhatsApp 96870 62705 · Call 98814 30619",
  },
};

export default function ContactPage() {
  return (
    <div className="pt-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <HoloPill className="mb-4">Get in touch</HoloPill>
        <h1 className="font-display text-holo text-5xl font-black tracking-tight sm:text-6xl">
          CONTACT
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
          Questions, bulk passes, group booking? Reach out.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href={`https://wa.me/${EVENT_CONFIG.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="ring-holo rounded-2xl p-[1px]"
          >
            <div className="glass-strong flex flex-col items-center gap-3 rounded-2xl p-6">
              <MessageCircle className="h-8 w-8 text-[#00f0ff]" />
              <div className="text-xs uppercase tracking-widest text-white/50">
                WhatsApp only
              </div>
              <div className="text-holo font-display text-2xl font-black">
                96870 62705
              </div>
            </div>
          </a>
          <a
            href={`tel:+${EVENT_CONFIG.call}`}
            className="ring-holo rounded-2xl p-[1px]"
          >
            <div className="glass-strong flex flex-col items-center gap-3 rounded-2xl p-6">
              <Phone className="h-8 w-8 text-[#ff2ed1]" />
              <div className="text-xs uppercase tracking-widest text-white/50">
                Tap to call
              </div>
              <div className="text-holo font-display text-2xl font-black">
                98814 30619
              </div>
            </div>
          </a>
        </div>
      </div>
      <EventDetails />
    </div>
  );
}
