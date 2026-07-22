import { forwardRef } from "react";
import { EVENT_CONFIG, TICKET_STATUS } from "@/lib/event-config";
import { QRCodeCanvas } from "./QRCode";

/*
 * A pass that is not yet verified must never look like a valid one.
 *
 * Previously every status rendered in the same cyan and the QR was always
 * drawn, so a `pending` order was visually indistinguishable from a paid pass —
 * at a dark gate that's a ticket. Unconfirmed states now get their own colour,
 * a watermark, and a suppressed QR.
 */

const STATUS_STYLES = {
  [TICKET_STATUS.PAID]: { label: "CONFIRMED", color: "#00f0ff" },
<<<<<<< HEAD
  [TICKET_STATUS.SUBMITTED]: { label: "AWAITING VERIFICATION", color: "#ffb020" },
=======
  [TICKET_STATUS.SUBMITTED]: {
    label: "AWAITING VERIFICATION",
    color: "#ffb020",
  },
>>>>>>> ca7f066851bbb3ddf5a079ac0fd3ae2b5589d67e
  [TICKET_STATUS.PENDING]: { label: "PAYMENT PENDING", color: "#ffb020" },
  [TICKET_STATUS.REJECTED]: { label: "NOT VALID", color: "#ff4d6d" },
  [TICKET_STATUS.EXPIRED]: { label: "EXPIRED", color: "#ff4d6d" },
};

export const DigitalPass = forwardRef(function DigitalPass({ ticket }, ref) {
  const isPaid = ticket.status === TICKET_STATUS.PAID;
<<<<<<< HEAD
  const status = STATUS_STYLES[ticket.status] || STATUS_STYLES[TICKET_STATUS.PENDING];
=======
  const status =
    STATUS_STYLES[ticket.status] || STATUS_STYLES[TICKET_STATUS.PENDING];
>>>>>>> ca7f066851bbb3ddf5a079ac0fd3ae2b5589d67e
  const used = Boolean(ticket.checkedInAt);

  return (
    <div
      ref={ref}
      className="ring-holo mx-auto rounded-3xl p-[1px]"
      style={{ width: 384, overflow: "hidden" }}
    >
      <div className="glass-strong relative overflow-hidden rounded-3xl">
        {!isPaid && (
          <div
            className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
            aria-hidden="true"
          >
            <div
              className="rotate-[-18deg] border-4 px-6 py-2 text-2xl font-black tracking-widest opacity-30"
              style={{ color: status.color, borderColor: status.color }}
            >
              {status.label}
            </div>
          </div>
        )}

        <div className="relative p-6 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                {EVENT_CONFIG.organizer}
              </div>
              <div className="text-holo font-display mt-1 text-2xl font-black leading-tight">
<<<<<<< HEAD
                FRESHO
=======
                SYMBI FRESHO
>>>>>>> ca7f066851bbb3ddf5a079ac0fd3ae2b5589d67e
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
                Admits
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {ticket.entries || ticket.quantity}
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
          <div className="grid h-[108px] w-[108px] shrink-0 place-items-center rounded-xl bg-white p-2">
            {isPaid ? (
              ticket.qrDataUrl ? (
                <img
                  src={ticket.qrDataUrl}
                  alt="Pass QR code"
                  width={92}
                  height={92}
                />
              ) : (
                <QRCodeCanvas value={ticket.id} size={92} />
              )
            ) : (
              // No QR until payment is verified — an unverified code scanning
              // "successfully" is exactly the confusion we're avoiding.
              <span className="px-1 text-center text-[9px] font-bold leading-tight text-black/60">
                QR APPEARS ONCE PAYMENT IS VERIFIED
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-white/50">
              {isPaid ? "Pass ID" : "Order Ref"}
            </div>
            <div className="text-holo font-display mt-1 truncate text-lg font-black">
              {isPaid ? ticket.id : ticket.orderRef || ticket.id}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-white/50">
              Status ·{" "}
              <span style={{ color: status.color }}>{status.label}</span>
            </div>
            {used && (
              <div className="mt-1 text-[10px] uppercase tracking-widest text-[#ff4d6d]">
                Already checked in
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
