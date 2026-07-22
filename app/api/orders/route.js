import { NextResponse } from "next/server";
import {
  createTicket,
  getReferral,
  releaseSeats,
  updateTicket,
  reserveSeats,
} from "@/lib/db";
import {
  getTier,
  MAX_QTY_PER_ORDER,
  ORDER_HOLD_MINUTES,
  TICKET_STATUS,
} from "@/lib/event-config";
import { generateOrderRef, generatePassId } from "@/lib/ids";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { cashfreeConfig, createCashfreeOrder } from "@/lib/cashfree";
import { confirmFreeOrder } from "@/lib/fulfill";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

const last10 = (v) => String(v || "").replace(/\D/g, "").slice(-10);

/**
 * Create an order and open a Cashfree checkout session for it.
 *
 * The response carries a `paymentSessionId`, which the browser SDK exchanges
 * for Cashfree's hosted payment page. Nothing here confirms anything: the pass
 * is minted only when Cashfree tells us the order is PAID, either over the
 * webhook or via /api/orders/[ref]/verify after the redirect.
 */
export async function POST(req) {
  let reserved = null;

  try {
    const cashfree = cashfreeConfig();
    if (!cashfree.enabled) {
      return NextResponse.json(
        { error: "Payments are not configured. Please contact the organizers." },
        { status: 503 }
      );
    }

    const limit = await rateLimit({
      bucket: "order",
      key: clientIp(req),
      limit: 10,
      windowSeconds: 600,
    });
    if (!limit.ok) return tooMany(limit.retryAfter);

    const body = await req.json().catch(() => null);
    if (!body)
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const {
      pass,
      qty,
      name,
      email,
      phone,
      partnerName,
      partnerPhone,
      college,
      referralCode,
    } = body || {};

    const tier = getTier(pass);
    if (!tier)
      return NextResponse.json({ error: "Invalid pass type" }, { status: 400 });

    // Math.floor: a fractional qty like 1.5 would otherwise survive the clamp
    // and put fractional seat counts into Redis.
    const quantity = Math.max(
      1,
      Math.min(MAX_QTY_PER_ORDER, Math.floor(Number(qty)) || 1)
    );

    if (!name || String(name).trim().length < 2)
      return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
    if (!EMAIL_RE.test(String(email || "")))
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    if (!MOBILE_RE.test(last10(phone)))
      return NextResponse.json(
        { error: "Enter a valid 10-digit Indian mobile number" },
        { status: 400 }
      );

    if (tier.id === "couple") {
      if (!partnerName || String(partnerName).trim().length < 2)
        return NextResponse.json(
          { error: "Partner name is required for a couple pass" },
          { status: 400 }
        );
      if (!MOBILE_RE.test(last10(partnerPhone)))
        return NextResponse.json(
          { error: "Enter a valid partner mobile number" },
          { status: 400 }
        );
    }

    // Price is always recomputed here. A client-sent total is a discount coupon
    // anyone can write themselves.
    const subtotal = tier.price * quantity;

    let discount = 0;
    let appliedCode = "";
    let referralApplied = false;
    const rawCode = String(referralCode || "").trim().toUpperCase();
    if (rawCode) {
      const referral = await getReferral(rawCode);
      if (referral && referral.active) {
        discount = Math.round((subtotal * Number(referral.discount || 0)) / 100);
        appliedCode = referral.code;
        referralApplied = true;
      }
      // An unknown or retired code is not an error — it just doesn't apply.
      // Failing the order here would lose a sale over a typo.
    }

    const total = Math.max(0, subtotal - discount);
    const entries = tier.entries * quantity;

    const seats = await reserveSeats(tier.id, entries);
    if (!seats.ok) {
      if (seats.reason === "sold_out")
        return NextResponse.json(
          {
            error: `Only ${seats.left} ${
              seats.left === 1 ? "entry" : "entries"
            } left for this pass.`,
            left: seats.left,
          },
          { status: 409 }
        );
      return NextResponse.json({ error: "Invalid pass type" }, { status: 400 });
    }
    reserved = { passId: tier.id, entries };

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + ORDER_HOLD_MINUTES * 60 * 1000
    ).toISOString();
    const orderRef = generateOrderRef();

    const ticket = {
      id: generatePassId(),
      orderRef,
      status: TICKET_STATUS.PENDING,
      passId: tier.id,
      passName: tier.name,
      quantity,
      entries,
      subtotal,
      discount,
      total,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: last10(phone),
      partnerName: partnerName ? String(partnerName).trim() : "",
      partnerPhone: partnerPhone ? last10(partnerPhone) : "",
      college: college ? String(college).trim() : "",
      referralCode: appliedCode,
      createdAt: now.toISOString(),
      expiresAt,
    };

    await createTicket(ticket);
    reserved = null; // committed — the order now owns these seats

    /*
     * A 100% referral discount leaves nothing to charge, and Cashfree rejects
     * orders under ₹1. Confirm it here instead of handing the buyer a checkout
     * they cannot complete. `allowFrom` on the PENDING state makes this the one
     * path that mints a pass without a gateway payment behind it — which is
     * correct, because there is no payment to make.
     */
    if (total <= 0) {
      const freed = await confirmFreeOrder(ticket.id);
      return NextResponse.json({
        id: ticket.id,
        orderRef,
        total,
        subtotal,
        discount,
        referralApplied,
        free: true,
        paid: freed.ok,
        expiresAt,
      });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    const session = await createCashfreeOrder({
      ticket,
      // Cashfree substitutes {order_id} itself. The checkout page reads the
      // ref off the query string and asks our server to re-verify.
      returnUrl: `${base}/checkout?order_ref=${orderRef}`,
      notifyUrl: `${base}/api/webhooks/cashfree`,
    });

    if (!session?.payment_session_id) {
      throw new Error("Cashfree returned no payment_session_id");
    }

    // "Payment in flight". The expiry sweeper leaves SUBMITTED orders alone, so
    // a buyer sitting on Cashfree's page can't have their seats pulled out from
    // under them mid-payment.
    await updateTicket(ticket.id, {
      status: TICKET_STATUS.SUBMITTED,
      cfOrderId: session.order_id,
      checkoutStartedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      id: ticket.id,
      orderRef,
      total,
      subtotal,
      discount,
      referralApplied,
      paymentSessionId: session.payment_session_id,
      cashfreeMode: cashfree.mode,
      expiresAt,
    });
  } catch (err) {
    console.error("orders POST error:", err);
    // Anything that throws after the reservation would otherwise strand those
    // seats forever — nothing else knows they were ever held.
    if (reserved) {
      try {
        await releaseSeats(reserved.passId, reserved.entries);
      } catch (releaseErr) {
        console.error("orders POST seat release failed:", releaseErr);
      }
    }
    return NextResponse.json(
      { error: "Could not start your payment. Please try again." },
      { status: 500 }
    );
  }
}
