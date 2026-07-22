"use client";

import { EVENT_CONFIG } from "@/lib/event-config";
import { HoloPill } from "./HoloPill";
import {
  Bell,
  Calendar,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="glass flex items-center gap-4 rounded-xl p-4">
      <div className="ring-holo grid h-10 w-10 shrink-0 place-items-center rounded-full">
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-white">
          {value}
        </div>
      </div>
    </div>
  );
}

export function EventDetails() {
  const [notify, setNotify] = useState(false);
  return (
    <section id="details" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-10 text-center">
        <HoloPill className="mb-4">The details</HoloPill>
        <h2 className="font-display text-holo text-4xl font-black tracking-tight sm:text-5xl">
          THE NIGHT
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
          One all-fandom fresher night. DJ, dance floor, lasers. Dress to be
          seen.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Row icon={Calendar} label="Date" value={EVENT_CONFIG.dateLabel} />
        <Row icon={Clock} label="Time" value={EVENT_CONFIG.timeLabel} />
        <Row
          icon={MapPin}
          label="Venue"
          value={
            <div className="flex flex-wrap items-center gap-2">
              <span>{EVENT_CONFIG.venue}</span>
              <button
                onClick={() => {
                  setNotify((v) => !v);
                  toast.success(
                    notify
                      ? "Notification off"
                      : "You'll be pinged when the venue drops",
                  );
                }}
                className={`ring-holo inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition ${
                  notify ? "text-[#00f0ff]" : "text-white/70"
                }`}
              >
                <Bell className="h-3 w-3" />
                {notify ? "Notifying" : "Notify me"}
              </button>
            </div>
          }
        />
        <Row
          icon={MessageCircle}
          label="Organizer"
          value={EVENT_CONFIG.organizer}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={`https://wa.me/${EVENT_CONFIG.whatsapp}`}
          target="_blank"
          rel="noreferrer"
          className="glass-strong inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition hover:text-[#00f0ff]"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp · 96870 62705
        </a>
        <a
          href={`tel:+${EVENT_CONFIG.call}`}
          className="glass-strong inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition hover:text-[#ff2ed1]"
        >
          <Phone className="h-4 w-4" /> Call · 99252 53545
        </a>
      </div>
    </section>
  );
}
