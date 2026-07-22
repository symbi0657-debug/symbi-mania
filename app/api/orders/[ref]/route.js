import { NextResponse } from "next/server";
import { getTicketByOrderRef } from "@/lib/db";
import { TICKET_STATUS } from "@/lib/event-config";
import { signTicketId } from "@/lib/ids";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Buyer-facing order status, polled from the checkout page while an order is
 * awaiting manual verification.
 *
 * Two things this route must not become:
 *
 *  1. A CREDENTIAL SOURCE. It used to return `qrDataUrl` — the scannable gate
 *     credential — for any paid order, keyed only on the order ref. An order
 *     ref is 6 chars of a 32-symbol alphabet (~1e9), which sounds large until
 *     you divide by a few hundred live orders: a few million requests finds a
 *     real one, and a valid pass falls out. `/api/ticket/[id]` deliberately
 *     demands an HMAC for exactly this reason; that reasoning applies here too.
 *     We now return a signed token and let the buyer follow the normal signed
 *     pass URL, so there is only ever one way to obtain a QR.
 *
 *  2. AN UNTHROTTLED ORACLE. Every other public read path is rate limited;
 *     this one wasn't, which is what made grinding the ref space practical.
 *
 * The response also carries no contact details — order refs get pasted into
 * UPI notes and shared, so knowing one must not expose a phone or email.
 */
export async function GET(req, { params }) {
  try {
    const limit = await rateLimit({
      bucket: "orderstatus",
      key: clientIp(req),
      limit: 60,
      windowSeconds: 600,
    });
    if (!limit.ok) return tooMany(limit.retryAfter);

    const ticket = await getTicketByOrderRef(params.ref);
    if (!ticket)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const paid = ticket.status === TICKET_STATUS.PAID;

    const order = {
      orderRef: ticket.orderRef,
      status: ticket.status,
      passName: ticket.passName,
      quantity: ticket.quantity,
      entries: ticket.entries,
      subtotal: ticket.subtotal,
      discount: ticket.discount,
      total: ticket.total,
      name: ticket.name,
      expiresAt: ticket.expiresAt,
      utrSubmitted: Boolean(ticket.utr),
      expired:
        ticket.status === TICKET_STATUS.EXPIRED ||
        (ticket.status === TICKET_STATUS.PENDING &&
          Date.now() > new Date(ticket.expiresAt).getTime()),
    };

    if (paid) {
      order.id = ticket.id;
      // The signed pass URL, not the QR image itself. Guessing a ref now yields
      // a link to a pass page rather than the credential in one hop, and the
      // pass page enforces its own signature check.
      order.passUrl = `/ticket/${ticket.id}?t=${signTicketId(ticket.id)}`;
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error("orders [ref] GET error:", err);
    return NextResponse.json(
      { error: "Could not load your order. Please try again." },
      { status: 500 }
    );
  }
}
