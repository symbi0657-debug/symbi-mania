import { EVENT_CONFIG } from "@/lib/event-config";
import { EventDetails } from "@/components/holo/EventDetails";
import { HoloPill } from "@/components/holo/HoloPill";
import { MessageCircle, Phone, Mail, MapPin } from "lucide-react";

export const metadata = {
  title: "Contact · Fresho Mania 3.0",
  description: "WhatsApp or call the Black Fox Entertainment team.",
  openGraph: {
    title: "Contact · Fresho Mania 3.0",
    description: "WhatsApp  77159 96384 · Call 9925253545",
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
                77159 96384
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
                9925253545
              </div>
            </div>
          </a>
        </div>

        <div className="glass-strong mt-6 rounded-2xl p-6 text-left">
          <div className="text-xs uppercase tracking-widest text-white/50">
            Organized by
          </div>
          <div className="text-holo font-display mt-1 text-xl font-black">
            Black Fox Entertainment Ent.
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Mail className="h-5 w-5 shrink-0 text-[#00f0ff]" />
            <a
              href="mailto:youremail@gmail.com"
              className="text-sm text-white/80 hover:text-white"
            >
              symbi0657@gmail.com
            </a>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Phone className="h-5 w-5 shrink-0 text-[#ff2ed1]" />
            <span className="text-sm text-white/80">+91 9925253545</span>
          </div>

          <div className="mt-3 flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#00f0ff]" />
            <span className="text-sm text-white/80">
              Lavale ,Pune, Maharashtra – 412115
            </span>
          </div>
        </div>
      </div>
      <EventDetails />
    </div>
  );
}
