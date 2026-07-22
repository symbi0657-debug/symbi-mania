/**
 * Order-expiry sweeper.
 *
 * ENV VARS
 *   CRON_SECRET  REQUIRED. Bearer token, sent by Vercel Cron as
 *                `Authorization: Bearer <CRON_SECRET>`. No secret set → every
 *                request is refused. This endpoint returns seats to inventory
 *                and must not be publicly callable.
 *   (plus Redis: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, or the
 *    KV_REST_API_* aliases — see lib/db.js)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS DOES, AND THE ONE THING IT MUST NEVER DO
 *
 *   pending   past expiresAt → EXPIRED, seats released. This is what stops
 *             abandoned checkouts from permanently eating a limited drop.
 *
 *   submitted past expiresAt → ASK CASHFREE FIRST, then expire or rescue.
 *             "submitted" now means "we opened a Cashfree checkout for this
 *             order", which is mostly abandoned carts — so unlike the old
 *             manual-UTR flow, these MUST be able to expire or a bounced
 *             checkout eats a seat forever. But some of them really did pay and
 *             we simply never got the webhook, so this never expires one on a
 *             timer alone: it re-reads the order from Cashfree, and a PAID order
 *             is fulfilled here instead. That makes this sweeper the last
 *             safety net behind the webhook and the return-page poll.
 *
 * Both branches release seats through expireUnpaidOrder(), which takes the same
 * lock confirmTicketPaid does. Nothing in this file may write a terminal status
 * directly: the sweeper always decides from a Cashfree read that is already
 * stale, so a confirmation can land mid-decision, and the lock is what stops
 * that from ending in an order that is both paid and expired.
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  audit,
  expireUnpaidOrder,
  listTicketsByStatus,
  updateTicket,
} from "@/lib/db";
import { TICKET_STATUS } from "@/lib/event-config";
import { fulfillPaidOrder } from "@/lib/fulfill";

export const dynamic = "force-dynamic";

// Cashfree states meaning no payment can still arrive. Anything else — ACTIVE
// above all — is treated as possibly-in-flight and left alone.
const CF_DEAD = new Set(["EXPIRED", "TERMINATED", "TERMINATION_REQUESTED"]);

/*
 * How long past the hold we keep waiting when Cashfree still says ACTIVE.
 * Normally moot: Cashfree marks the order EXPIRED at order_expiry_time, so the
 * first sweep after the hold sees a dead order and reclaims the seat straight
 * away. This is the backstop for when it doesn't, and it is the maximum extra
 * time a seat can sit unavailable — a seat held 15 minutes too long is a far
 * cheaper mistake than a paid buyer refused at the door.
 */
const EXPIRE_GRACE_MS = 15 * 60 * 1000;

// The sweeper walks every pending order sequentially. A few hundred stale
// orders after a busy sales day is several seconds of round trips, which
// overruns the 10s default.
export const maxDuration = 60;
export const runtime = "nodejs";

/** Constant-time bearer comparison, so the secret can't be probed byte by byte. */
function authorized(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(req.headers.get("authorization") || "");

  if (provided.length !== expected.length) {
    crypto.timingSafeEqual(expected, expected);
    return false;
  }
  return crypto.timingSafeEqual(provided, expected);
}

const isPast = (iso, now) => {
  const t = Date.parse(iso || "");
  // No/unparseable expiry → treat as not expired. Guessing here would delete a
  // live order's seats.
  return Number.isFinite(t) && t <= now;
};

export async function GET(req) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  let expired = 0;
  let seatsReleased = 0;
  let flaggedOverdue = 0;
  let rescued = 0;
  let stillSettling = 0;
  let pendingScanned = 0;
  let submittedScanned = 0;
  const errors = [];

  try {
    // ── Pending: expire and return the seats ──────────────────────────────
    const pending = await listTicketsByStatus(TICKET_STATUS.PENDING);
    pendingScanned = pending.length;

    for (const t of pending) {
      if (!isPast(t.expiresAt, now)) continue;
      try {
        /*
         * Lock-guarded like the submitted branch. PENDING is in PAYABLE_FROM,
         * and an order can briefly be PENDING with a live Cashfree order behind
         * it (checkout created, but the status write to SUBMITTED failed). Rare,
         * but the consequence is the expensive one — a confirmation racing this
         * write and losing means a paid buyer whose seat got resold — and
         * routing through the same mutex costs nothing.
         */
        const gone = await expireUnpaidOrder(t.id);
        if (!gone.ok) continue; // confirmed underneath us, or already gone
        expired++;
        seatsReleased += gone.released?.released ? gone.released.entries : 0;

        await audit("order.expired", {
          id: t.id,
          orderRef: t.orderRef,
          passId: t.passId,
          entries: t.entries,
          total: t.total,
          expiresAt: t.expiresAt,
          by: "auto:expiry-sweeper",
        });
      } catch (err) {
        // One bad record must not abort the sweep for everyone else.
        console.error(`expire-orders: failed on ${t.id}:`, err);
        errors.push({ id: t.id, error: err?.message || String(err) });
      }
    }

    // ── Submitted: confirm with Cashfree, then rescue or expire ───────────
    const submitted = await listTicketsByStatus(TICKET_STATUS.SUBMITTED);
    submittedScanned = submitted.length;

    for (const t of submitted) {
      if (!isPast(t.expiresAt, now)) continue;
      try {
        /*
         * Ask the gateway before touching anything. If the buyer did pay and we
         * missed the webhook, this both mints their pass and — critically —
         * stops the branch below from selling their seat out from under them.
         */
        const rescue = await fulfillPaidOrder(t.orderRef, { source: "sweeper" });

        if (rescue.ok) {
          if (!rescue.alreadyPaid) {
            rescued++;
            await audit("order.rescued", {
              id: t.id,
              orderRef: t.orderRef,
              total: t.total,
              note: "Cashfree reported PAID but no webhook arrived — pass issued by the sweeper.",
            });
          }
          continue;
        }

        /*
         * An amount mismatch is the one failure we must not resolve by
         * expiring: money was captured, it just doesn't match the order. Leave
         * the seats held and flag it for a human — fulfillPaidOrder has already
         * written paymentMismatch onto the record.
         */
        if (rescue.reason === "amount_mismatch") {
          if (!t.overdue) {
            await updateTicket(t.id, {
              overdue: true,
              overdueSince: new Date(now).toISOString(),
              needsReview: true,
            });
            flaggedOverdue++;
          }
          continue;
        }

        /*
         * Only an explicit "the gateway says this is not paid" may release
         * seats. Every other failure — a lock held by a confirmation landing
         * right now, a status we don't recognise — means we do not know, and
         * "we don't know" must never resolve to "resell the seat". Cashfree can
         * report PAID while confirmTicketPaid loses the lock race, and treating
         * that as unpaid would expire an order that was in fact paid.
         */
        if (rescue.reason !== "not_paid") {
          stillSettling++;
          continue;
        }

        /*
         * "Not paid yet" and "never going to be paid" look identical in a
         * single status read, and getting that wrong costs a buyer their money.
         *
         * Cashfree's order_expiry_time only blocks *starting* a payment. A UPI
         * collect request approved in the buyer's bank app a minute after our
         * hold lapses still settles and flips the order to PAID. If we expire
         * on the timer alone we release the seat, resell it, and then reject
         * the confirmation when it arrives — money captured, no pass, no
         * refund, and the buyer finds out at the gate.
         *
         * So an order is only reclaimed once Cashfree itself calls it dead, or
         * once it is so far past the hold that no payment could still be in
         * flight. ACTIVE means "still settling" here, exactly as it does on the
         * buyer's return page.
         */
        const terminalAtGateway = CF_DEAD.has(rescue.orderStatus);
        const pastGrace = now > Date.parse(t.expiresAt) + EXPIRE_GRACE_MS;
        if (!terminalAtGateway && !pastGrace) {
          stillSettling++;
          continue;
        }

        /*
         * Race-safe: expireUnpaidOrder takes the same lock confirmTicketPaid
         * does. A webhook landing between the Cashfree read above and this
         * write wins, and we leave the order alone rather than stomping a
         * freshly-confirmed pass back to EXPIRED.
         */
        const gone = await expireUnpaidOrder(t.id);
        if (!gone.ok) {
          // Confirmed underneath us. That is the good outcome — nothing to do.
          continue;
        }
        expired++;
        seatsReleased += gone.released?.released ? gone.released.entries : 0;

        await audit("order.expired", {
          id: t.id,
          orderRef: t.orderRef,
          passId: t.passId,
          entries: t.entries,
          total: t.total,
          expiresAt: t.expiresAt,
          by: "auto:expiry-sweeper",
          note: `Checkout abandoned — Cashfree reported ${
            rescue.orderStatus || rescue.reason
          }.`,
        });
      } catch (err) {
        // A Cashfree outage lands here. Doing nothing is the right failure
        // mode: the order keeps its seats and the next sweep retries.
        console.error(`expire-orders: failed on submitted ${t.id}:`, err);
        errors.push({ id: t.id, error: err?.message || String(err) });
      }
    }

    return NextResponse.json({
      ok: true,
      at: new Date(now).toISOString(),
      pendingScanned,
      submittedScanned,
      expired,
      seatsReleased,
      rescued,
      stillSettling,
      flaggedOverdue,
      errors,
    });
  } catch (err) {
    console.error("cron/expire-orders failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "sweep failed",
        expired,
        seatsReleased,
        rescued,
        stillSettling,
        flaggedOverdue,
        errors,
      },
      { status: 500 }
    );
  }
}
