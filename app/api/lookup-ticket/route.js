import { NextResponse } from "next/server";
import {
  getTicketById,
  findTicketsByEmail,
  isRedisConfigured,
} from "@/lib/db";
import { TICKET_STATUS } from "@/lib/event-config";
import { generateQRBuffer } from "@/lib/qr";
import { sendTicketEmail, isMailConfigured } from "@/lib/mailer";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/*
 * Buyer-facing pass lookup.
 *
 * The previous version accepted a phone number or email and returned the full
 * ticket — name, email, phone, partner details — to whoever asked. Indian
 * mobile numbers are a 10-digit space with a known prefix, so that endpoint let
 * anyone enumerate the attendee list and harvest contact details.
 *
 * The fix splits lookup by what the query actually proves:
 *
 *   Pass ID → 40 bits of CSPRNG entropy, so possessing it IS the proof of
 *             ownership. Return the pass.
 *   Email   → proves nothing; anyone can type someone else's address. Never
 *             return the pass — re-send it to the address on file instead.
 *   Phone   → proves nothing, and we can't deliver to it, so only confirm
 *             existence and redirect the user to a channel that works.
 */

const PASS_ID_RE = /^FM3-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicView(t) {
  // Everything the buyer needs to render their pass, and nothing that would be
  // useful to someone who isn't them.
  return {
    id: t.id,
    orderRef: t.orderRef,
    passId: t.passId,
    passName: t.passName,
    quantity: t.quantity,
    entries: t.entries,
    total: t.total,
    name: t.name,
    status: t.status,
    qrDataUrl: t.status === TICKET_STATUS.PAID ? t.qrDataUrl : null,
    checkedInAt: t.checkedInAt || null,
    createdAt: t.createdAt,
  };
}

export async function POST(req) {
  try {
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: "Ticket lookup is temporarily unavailable." },
        { status: 503 }
      );
    }

    const limit = await rateLimit({
      bucket: "lookup",
      key: clientIp(req),
      limit: 20,
      windowSeconds: 600,
    });
    if (!limit.ok) return tooMany(limit.retryAfter);

    const { query } = await req.json().catch(() => ({}));
    const q = String(query || "").trim();
    if (!q) {
      return NextResponse.json(
        { error: "Enter your Pass ID, email, or phone number" },
        { status: 400 }
      );
    }

    // ── Pass ID: possession of the ID is the credential. ──────────────────
    const upper = q.toUpperCase();
    if (PASS_ID_RE.test(upper)) {
      const ticket = await getTicketById(upper);
      if (!ticket) {
        return NextResponse.json({ error: "No pass found" }, { status: 404 });
      }
      return NextResponse.json({ mode: "ticket", ticket: publicView(ticket) });
    }

    // ── Email: mail it to the address on file, never to the screen. ───────
    if (EMAIL_RE.test(q)) {
      const tickets = await findTicketsByEmail(q);
      const paid = tickets.filter((t) => t.status === TICKET_STATUS.PAID);

      // Not awaited: response time must not reveal whether a match existed.
      if (paid.length && isMailConfigured()) {
        Promise.all(
          paid.map(async (t) => {
            try {
              await sendTicketEmail({
                to: t.email,
                ticket: t,
                qrDataBuffer: await generateQRBuffer(t.id),
              });
            } catch (err) {
              console.error("lookup resend failed:", t.id, err);
            }
          })
        ).catch(() => {});
      }

      // Same message whether or not anything matched — no enumeration oracle.
      return NextResponse.json({
        mode: "emailed",
        message:
          "If a confirmed pass exists for that email, we've just re-sent it. Check your inbox and spam folder.",
      });
    }

    // ── Phone: can't verify ownership, can't deliver to it. ───────────────
    //
    // The response is identical whether or not a pass exists. Returning
    // found:true/false made this an existence oracle — "did this person buy a
    // ticket?" answerable for any phone number — which is the same class of
    // leak the email path above is carefully written to avoid.
    if (q.replace(/\D/g, "").length >= 10) {
      return NextResponse.json({
        mode: "phone",
        message:
          "For your security we can't look up passes by phone number. Enter your Pass ID to see your pass, or your email address to have it re-sent.",
      });
    }

    return NextResponse.json(
      {
        error:
          "Enter a valid Pass ID, email address, or 10-digit phone number",
      },
      { status: 400 }
    );
  } catch (err) {
    console.error("lookup-ticket error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
