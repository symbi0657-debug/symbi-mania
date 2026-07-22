import { audit, confirmTicketPaid, getTicketByOrderRef, updateTicket } from "@/lib/db";
import { TICKET_STATUS } from "@/lib/event-config";
import { generateQRBuffer, generateQRDataUrl } from "@/lib/qr";
import { sendTicketEmail } from "@/lib/mailer";
import { fetchCashfreeOrder } from "@/lib/cashfree";

// The gateway confirms straight from either pre-payment state. EXPIRED and
// REJECTED are deliberately absent: their seats are already back in the pool,
// so minting from them would oversell the tier.
const PAYABLE_FROM = [TICKET_STATUS.PENDING, TICKET_STATUS.SUBMITTED];

/**
 * Render the QR and email the pass.
 *
 * Everything in here is best-effort by design. It runs only after the ticket is
 * already marked PAID and the money is already captured, so a dead SMTP server
 * or a QR failure must never roll anything back — a missing email is a one-click
 * resend from /admin/tickets, a lost confirmation is a paid guest turned away at
 * the door.
 */
async function deliverPass(ticket) {
  let out = ticket;

  let qrBuffer = null;
  try {
    qrBuffer = await generateQRBuffer(out.id);
    const qrDataUrl = await generateQRDataUrl(out.id);
    out = (await updateTicket(out.id, { qrDataUrl })) || out;
  } catch (qrErr) {
    console.error("fulfill: QR generation failed for", out.id, qrErr);
  }

  let emailSent = false;
  let emailError = null;
  try {
    if (!qrBuffer) throw new Error("QR code could not be generated");
    await sendTicketEmail({ to: out.email, ticket: out, qrDataBuffer: qrBuffer });
    emailSent = true;
  } catch (mailErr) {
    console.error("fulfill: email send failed for", out.id, mailErr);
    emailError = String(mailErr?.message || mailErr);
  }

  out =
    (await updateTicket(out.id, {
      emailSent,
      emailError,
      emailSentAt: emailSent ? new Date().toISOString() : out.emailSentAt || null,
    })) || out;

  return { ticket: out, emailSent };
}

/**
 * Turn a paid Cashfree order into a delivered pass.
 *
 * Two callers reach this and they race by design:
 *   - the webhook, which is what fires when the buyer closes the tab, and
 *   - /api/orders/[ref]/verify, polled by the checkout page after the redirect.
 *
 * Whichever arrives first wins; the other must be a harmless no-op. That is
 * guaranteed by confirmTicketPaid's SETNX lock, not by anything here — do not
 * add a read-then-write "is it already paid?" check in front of it, because that
 * is exactly the race the lock exists to close. (The early return below is a
 * cheap skip for the common case, not the correctness guarantee.)
 */
export async function fulfillPaidOrder(orderRef, { source }) {
  const ticket = await getTicketByOrderRef(orderRef);
  if (!ticket) return { ok: false, reason: "not_found" };
  if (ticket.status === TICKET_STATUS.PAID)
    return { ok: true, alreadyPaid: true, ticket };

  // Never take the buyer's word — or a return_url hit — for it. Ask Cashfree.
  const cf = await fetchCashfreeOrder(orderRef);
  if (cf?.order_status !== "PAID") {
    return { ok: false, reason: "not_paid", orderStatus: cf?.order_status };
  }

  /*
   * Guard against a capture that doesn't match what we charged.
   *
   * Note what this does and does NOT do. `order_amount` is the figure we sent
   * at order creation and Cashfree echoes it back, so this only catches the
   * order being altered at Cashfree's end — it is not the defence against a
   * partial capture. THAT is the `order_status !== "PAID"` check above: a
   * part-paid order reads PARTIALLY_PAID and never reaches this line.
   */
  if (Math.round(Number(cf.order_amount) * 100) !== Math.round(ticket.total * 100)) {
    await updateTicket(ticket.id, {
      paymentMismatch: `Cashfree captured ${cf.order_amount}, order total was ${ticket.total}`,
    });
    await audit("payment_amount_mismatch", {
      id: ticket.id,
      orderRef,
      captured: cf.order_amount,
      expected: ticket.total,
    });
    return { ok: false, reason: "amount_mismatch" };
  }

  const result = await confirmTicketPaid(ticket.id, {
    verifiedBy: `cashfree:${source}`,
    allowFrom: PAYABLE_FROM,
  });

  if (!result.ok) {
    /*
     * Only report success when the record genuinely reads PAID. "already_paid"
     * used to be trusted blindly, which meant a confirm that took the lock and
     * then died mid-write — leaving the order SUBMITTED but locked — reported
     * `paid: true` to the buyer, complete with a signed pass URL, for a pass
     * that was never issued and never emailed.
     */
    if (
      result.reason === "already_paid" &&
      result.ticket?.status === TICKET_STATUS.PAID
    ) {
      return { ok: true, alreadyPaid: true, ticket: result.ticket };
    }
    return { ok: false, reason: result.reason, status: result.status };
  }

  // Record the gateway's own reference — this is what you search on in the
  // Cashfree dashboard when a buyer disputes a charge.
  const stamped =
    (await updateTicket(result.ticket.id, {
      cfOrderId: cf.order_id,
      paidAt: new Date().toISOString(),
    })) || result.ticket;

  const { ticket: delivered, emailSent } = await deliverPass(stamped);

  await audit("payment_confirmed", {
    id: delivered.id,
    orderRef,
    source,
    total: delivered.total,
    cfOrderId: cf.order_id,
    emailSent,
  });

  return { ok: true, ticket: delivered, emailSent };
}

/**
 * Confirm an order with nothing left to pay (a 100% referral discount).
 *
 * Cashfree rejects orders under ₹1, so there is no gateway leg to wait on. This
 * is the only path that mints a pass with no payment behind it, which is correct
 * precisely because there was no payment to make — it must therefore never be
 * reachable for an order whose total is above zero.
 */
export async function confirmFreeOrder(ticketId) {
  const result = await confirmTicketPaid(ticketId, {
    verifiedBy: "free:referral",
    allowFrom: PAYABLE_FROM,
  });
  if (!result.ok) return { ok: false, reason: result.reason };

  if (Number(result.ticket.total) > 0) {
    // Defensive: a paid order must never arrive here.
    console.error("confirmFreeOrder called on a non-zero order", ticketId);
  }

  const { ticket, emailSent } = await deliverPass(result.ticket);
  await audit("payment_confirmed", {
    id: ticket.id,
    orderRef: ticket.orderRef,
    source: "free",
    total: ticket.total,
    emailSent,
  });
  return { ok: true, ticket, emailSent };
}
