/**
 * Cashfree webhook signature verification.
 *
 * This check is the entire security boundary on /api/webhooks/cashfree — without
 * it that route is an unauthenticated "mark any order paid" button — so it gets
 * a test that runs before every deploy.
 */
import crypto from "crypto";
process.env.CASHFREE_SECRET_KEY = "test_secret_key_abcdefghijklmnop";

const { verifyWebhookSignature, isFreshTimestamp } = await import(
  "../lib/cashfree.js"
);

const raw = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: "FM3-AB12CD" } } });
const ts = String(Math.floor(Date.now() / 1000));
const good = crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(ts + raw).digest("base64");

let fail = 0;
const t = (name, cond) => {
  if (!cond) fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
};

t("valid signature accepted", verifyWebhookSignature({ timestamp: ts, rawBody: raw, signature: good }) === true);
t("tampered body rejected", verifyWebhookSignature({ timestamp: ts, rawBody: raw + " ", signature: good }) === false);
t("wrong signature rejected", verifyWebhookSignature({ timestamp: ts, rawBody: raw, signature: "AAAA" }) === false);
t("missing signature rejected", verifyWebhookSignature({ timestamp: ts, rawBody: raw, signature: null }) === false);
t("different timestamp rejected", verifyWebhookSignature({ timestamp: String(+ts + 1), rawBody: raw, signature: good }) === false);
t("fresh timestamp ok", isFreshTimestamp(ts) === true);
t("stale timestamp rejected", isFreshTimestamp(String(+ts - 4000)) === false);
t("garbage timestamp rejected", isFreshTimestamp("nonsense") === false);

console.log(`\n${fail ? fail + " failed" : "all signature checks passed"}`);
process.exit(fail ? 1 : 0);
