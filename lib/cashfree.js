import crypto from "crypto";

/**
 * Cashfree Payment Gateway.
 *
 * Replaces the old collect-over-UPI-and-reconcile-by-hand flow. Cashfree is a
 * real PSP: it takes the money, tells us authoritatively whether it landed, and
 * we mint the pass off that answer. There is no UTR to type, no bank SMS to
 * parse, and no admin approval queue — the only source of truth for "was this
 * paid" is Cashfree's own order status.
 *
 * Configuration is two values: CASHFREE_APP_ID and CASHFREE_SECRET_KEY.
 *
 * Docs: https://www.cashfree.com/docs/api-reference/payments/latest/orders/create
 */

// Pinned deliberately. Cashfree versions its API by date and changes response
// shapes between versions; letting this float would break parsing silently.
const API_VERSION = "2025-01-01";

const BASE = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

export function cashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID || "";
  const secretKey = process.env.CASHFREE_SECRET_KEY || "";
  // Defaults to sandbox. Going live is an explicit act — the failure mode of
  // the reverse default is charging real cards from a staging deploy.
  const mode =
    process.env.CASHFREE_MODE === "production" ? "production" : "sandbox";

  return {
    appId,
    secretKey,
    mode,
    baseUrl: BASE[mode],
    enabled: Boolean(appId && secretKey),
  };
}

function headers() {
  const { appId, secretKey } = cashfreeConfig();
  return {
    "Content-Type": "application/json",
    "x-api-version": API_VERSION,
    "x-client-id": appId,
    "x-client-secret": secretKey,
  };
}

/**
 * Cashfree's own reference for one of our orders. Namespaced so that a Cashfree
 * dashboard search on "FM3-" finds exactly this event's orders, and so the ref
 * clears their 3-character minimum.
 */
export const cfOrderId = (orderRef) => `FM3-${orderRef}`;

async function call(path, init) {
  const { baseUrl } = cashfreeConfig();
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers: headers() });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    // Cashfree reports the actionable part in `message`; surface it in logs but
    // never to the buyer, since it can echo back our own request payload.
    const err = new Error(
      data?.message || `Cashfree ${path} failed with ${res.status}`
    );
    err.status = res.status;
    err.code = data?.code;
    err.cashfree = data;
    throw err;
  }

  return data;
}

/**
 * Create the Cashfree order and get back a payment_session_id, which is what
 * the browser SDK exchanges for a hosted checkout page.
 *
 * `notify_url` is where Cashfree posts the webhook. `return_url` is where the
 * buyer's browser lands afterwards — it is NOT a confirmation, only a hint to
 * go re-check the order; anyone can navigate to it.
 */
export async function createCashfreeOrder({ ticket, returnUrl, notifyUrl }) {
  /*
   * Cashfree rejects an expiry closer than ~15 minutes out. ORDER_HOLD_MINUTES
   * is 30 today, so this normally passes straight through — but if someone
   * shortens the hold, silently omitting the field is far better than every
   * single order failing to create. Our own expiry sweeper is the stricter
   * clock in that case anyway.
   */
  const minutesOut = (Date.parse(ticket.expiresAt) - Date.now()) / 60000;
  const expiry = minutesOut >= 16 ? { order_expiry_time: ticket.expiresAt } : {};

  return call("/orders", {
    method: "POST",
    body: JSON.stringify({
      order_id: cfOrderId(ticket.orderRef),
      order_amount: Number(ticket.total),
      order_currency: "INR",
      customer_details: {
        // Must be 3-50 alphanumeric. The pass id already satisfies that and is
        // unique per order, so no separate customer record is needed.
        customer_id: String(ticket.id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 50),
        customer_name: ticket.name,
        customer_email: ticket.email,
        customer_phone: ticket.phone,
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
      },
      order_note: `${ticket.passName} x${ticket.quantity}`,
      ...expiry,
      order_tags: {
        orderRef: ticket.orderRef,
        passId: ticket.passId,
      },
    }),
  });
}

/** Authoritative status read. `order_status === "PAID"` is the only green light. */
export async function fetchCashfreeOrder(orderRef) {
  return call(`/orders/${encodeURIComponent(cfOrderId(orderRef))}`, {
    method: "GET",
  });
}

/**
 * Verify a webhook came from Cashfree.
 *
 * The signed payload is `timestamp + rawBody`, HMAC-SHA256 with the secret key,
 * base64. The raw body matters: re-serializing the parsed JSON reorders keys and
 * the signature stops matching.
 *
 * Without this check the webhook endpoint is an unauthenticated "mark this order
 * paid" button, so a failure here must reject, never warn.
 */
export function verifyWebhookSignature({ timestamp, rawBody, signature }) {
  const { secretKey } = cashfreeConfig();
  if (!secretKey || !timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(`${timestamp}${rawBody}`)
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Reject webhooks whose timestamp is far from now, so a signed payload captured
 * off the wire can't be replayed indefinitely.
 */
export function isFreshTimestamp(timestamp, toleranceSeconds = 300) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  // Cashfree sends epoch seconds; be tolerant of a millisecond variant.
  const seconds = ts > 1e12 ? ts / 1000 : ts;
  return Math.abs(Date.now() / 1000 - seconds) <= toleranceSeconds;
}
