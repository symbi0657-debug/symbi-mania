import { NextResponse } from "next/server";
import { getTicketByOrderRef } from "@/lib/db";
import { TICKET_STATUS } from "@/lib/event-config";
import { signTicketId } from "@/lib/ids";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { fulfillPaidOrder } from "@/lib/fulfill";

export const dynamic = "force-dynamic";

/**
 * Ask Cashfree whether this order is actually paid, and if so mint the pass.
 *
 * The checkout page calls this after Cashfree redirects the buyer back. It is
 * what makes the flow work on localhost and on any deploy where the webhook is
 * slow, blocked, or misconfigured — the webhook stays the backstop for buyers
 * who never come back, but nobody has to wait on it to see their pass.
 *
 * Safe to expose unauthenticated: knowing an order ref lets you ask us to
 * re-read that order's status from Cashfree, which is exactly what the buyer
 * standing on the page needs, and it cannot confirm anything Cashfree hasn't
 * already been paid for. It is rate limited all the same, because each call
 * costs an upstream request.
 */
export async function POST(req, { params }) {
  try {
    const limit = await rateLimit({
      bucket: "verify",
      key: clientIp(req),
      limit: 40,
      windowSeconds: 600,
    });
    if (!limit.ok) return tooMany(limit.retryAfter);

    const ref = String(params.ref || "").trim().toUpperCase();
    const existing = await getTicketByOrderRef(ref);
    if (!existing)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const result =
      existing.status === TICKET_STATUS.PAID
        ? { ok: true, ticket: existing, alreadyPaid: true }
        : await fulfillPaidOrder(ref, { source: "return" });

    if (!result.ok) {
      return NextResponse.json({
        paid: false,
        status: existing.status,
        // Cashfree's word for where the payment got to, so the page can tell
        // "still processing" apart from "it failed, try again".
        orderStatus: result.orderStatus || null,
        reason: result.reason,
      });
    }

    const ticket = result.ticket;
    return NextResponse.json({
      paid: true,
      id: ticket.id,
      orderRef: ticket.orderRef,
      passName: ticket.passName,
      quantity: ticket.quantity,
      entries: ticket.entries,
      total: ticket.total,
      // The signed pass URL, never the QR image itself — same rule as
      // /api/orders/[ref]: there is only one way to obtain a scannable
      // credential, and it goes through the signature check.
      passUrl: `/ticket/${ticket.id}?t=${signTicketId(ticket.id)}`,
      emailSent: result.emailSent ?? true,
    });
  } catch (err) {
    console.error("orders verify error:", err);
    return NextResponse.json(
      { error: "Could not check your payment. Please try again." },
      { status: 500 }
    );
  }
}
