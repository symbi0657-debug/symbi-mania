import { NextResponse } from "next/server";
import { getTicketById, isRedisConfigured } from "@/lib/db";
import { TICKET_STATUS } from "@/lib/event-config";
import { verifyTicketToken } from "@/lib/ids";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Public pass view, reached by scanning the QR.
 *
 * Two changes from the original beyond the PII strip it already did:
 *
 *  1. The QR link carries an HMAC (`?t=`). Requests without a valid token are
 *     rejected, so the endpoint can't be walked by generating plausible IDs.
 *  2. `qrDataUrl` is only returned for a PAID pass. Previously a pending order
 *     could render a pass that looked identical to a confirmed one, which at a
 *     gate is indistinguishable from a valid ticket.
 */
export async function GET(req, { params }) {
  try {
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: "Pass lookup is temporarily unavailable." },
        { status: 503 }
      );
    }

    const limit = await rateLimit({
      bucket: "ticketview",
      key: clientIp(req),
      limit: 60,
      windowSeconds: 600,
    });
    if (!limit.ok) return tooMany(limit.retryAfter);

    const id = String(params.id || "").toUpperCase();
    const token = req.nextUrl.searchParams.get("t");

    if (!verifyTicketToken(id, token)) {
      // Same 404 as a genuinely missing pass — don't confirm that an ID exists
      // to someone who couldn't produce its signature.
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    const ticket = await getTicketById(id);
    if (!ticket) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    const isPaid = ticket.status === TICKET_STATUS.PAID;

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        orderRef: ticket.orderRef,
        passId: ticket.passId,
        passName: ticket.passName,
        quantity: ticket.quantity,
        entries: ticket.entries,
        total: ticket.total,
        name: ticket.name,
        status: ticket.status,
        qrDataUrl: isPaid ? ticket.qrDataUrl : null,
        checkedInAt: ticket.checkedInAt || null,
        createdAt: ticket.createdAt,
      },
    });
  } catch (err) {
    console.error("ticket view error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
