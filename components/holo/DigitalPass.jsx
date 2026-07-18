import { forwardRef } from "react";
import { EVENT_CONFIG } from "@/lib/event-config";
import { QRCodeCanvas } from "./QRCode";

export const DigitalPass = forwardRef(function DigitalPass({ ticket }, ref) {
  return (
    <div
      ref={ref}
      className="ring-holo mx-auto rounded-3xl p-[1px]"
      style={{ width: 384, overflow: "hidden" }}
    >
      <div className="glass-strong relative overflow-hidden rounded-3xl">
        <div className="relative p-6 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                {EVENT_CONFIG.organizer}
              </div>
              <div className="text-holo font-display mt-1 text-2xl font-black leading-tight">
                SYMBI FRESHO
                <br />
                Mania 3.0
              </div>
            </div>
            <div
              className="text-holo font-display text-xl font-black italic"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              AS
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                Attendee
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {ticket.name}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                Pass
              </div>
              <div className="text-holo mt-1 text-sm font-bold">
                {ticket.passName} × {ticket.quantity}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                Date
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {EVENT_CONFIG.dateLabel}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                Doors
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                6:00 PM
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-black" />
          <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-black" />
          <div className="mx-6 border-t border-dashed border-white/20" />
        </div>

        <div className="flex items-center gap-4 p-6">
          <div className="rounded-xl bg-white p-2">
            {ticket.qrDataUrl ? (
              <img
                src={ticket.qrDataUrl}
                alt="Pass QR code"
                width={92}
                height={92}
              />
            ) : (
              <QRCodeCanvas value={ticket.id} size={92} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-white/50">
              Pass ID
            </div>
            <div className="text-holo font-display mt-1 truncate text-lg font-black">
              {ticket.id}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-white/50">
              Status ·{" "}
              <span className="text-[#00f0ff]">
                {ticket.status === "paid" ? "CONFIRMED" : "PENDING"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
