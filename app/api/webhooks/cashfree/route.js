import { NextResponse } from "next/server";
import { audit } from "@/lib/db";
import {
  cashfreeConfig,
  isFreshTimestamp,
  verifyWebhookSignature,
} from "@/lib/cashfree";
import { fulfillPaidOrder } from "@/lib/fulfill";

export const dynamic = "force-dynamic";

/**
 * Cashfree payment webhook.
 *
 * This is what confirms the pass for every buyer who closes the tab before the
 * redirect lands — which, on mobile, is most of them. The checkout page's own
 * polling covers the buyer who stays; this covers everyone else.
 *
 * The signature check is the entire security boundary. Without it, this route is
 * an unauthenticated "mark any order paid" button, so anything that fails to
 * verify is rejected outright and nothing is trusted from the body until it has.
 *
 * Configure the URL in the Cashfree dashboard under
 * Developers → Webhooks → Payment webhooks:
 *   https://YOUR-DOMAIN/api/webhooks/cashfree
 */
export async function POST(req) {
  try {
    const { enabled } = cashfreeConfig();
    if (!enabled) {
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }

    // The RAW body, before any parsing. Re-serializing the parsed object
    // reorders keys and the signature stops matching.
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");

    if (!verifyWebhookSignature({ timestamp, rawBody, signature })) {
      console.error("cashfree webhook: bad signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // A valid signature is forever; without a freshness window a payload
    // captured once could be replayed indefinitely.
    if (!isFreshTimestamp(timestamp)) {
      console.error("cashfree webhook: stale timestamp", timestamp);
      return NextResponse.json({ error: "Stale webhook" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const type = event?.type || "";
    const cfOrderId = event?.data?.order?.order_id || "";
    // We namespace Cashfree order ids as FM3-<orderRef>; strip it back off.
    const orderRef = cfOrderId.replace(/^FM3-/, "");

    if (!orderRef) {
      return NextResponse.json({ ok: true, ignored: "no order id" });
    }

    // Only success events mint a pass. Everything else is logged and dropped:
    // a failed or dropped payment leaves the order alone so the buyer can retry
    // it, and the expiry sweeper returns the seats if they don't.
    if (type !== "PAYMENT_SUCCESS_WEBHOOK") {
      await audit("cashfree_webhook", { type, orderRef, handled: false });
      return NextResponse.json({ ok: true, ignored: type });
    }

    // fulfillPaidOrder re-reads the order from Cashfree rather than trusting the
    // body, so a replayed-but-fresh payload still can't confirm an unpaid order.
    const result = await fulfillPaidOrder(orderRef, { source: "webhook" });

    if (!result.ok) {
      console.error("cashfree webhook: fulfil failed", orderRef, result.reason);
      // 200 regardless: Cashfree retries non-2xx, and every failure reason here
      // (not_found, amount_mismatch, expired) is permanent — retrying it just
      // generates noise. They are recorded in the audit log for a human.
      await audit("cashfree_webhook", {
        type,
        orderRef,
        handled: false,
        reason: result.reason,
      });
      return NextResponse.json({ ok: true, handled: false });
    }

    return NextResponse.json({ ok: true, handled: true });
  } catch (err) {
    console.error("cashfree webhook error:", err);
    // A thrown error is the one case worth a retry — it's likely transient
    // (Redis blip, Cashfree timeout), unlike the permanent reasons above.
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
