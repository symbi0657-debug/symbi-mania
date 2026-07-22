/**
 * Environment validation.
 *
 * The failure this exists to prevent already happened once in this codebase:
 * Upstash was imported but never configured, so every payment "succeeded" and
 * then silently failed to produce a ticket. Misconfiguration should be loud, at
 * startup, not discovered by a buyer who has already paid.
 *
 * Run `npm run check-env` before deploying.
 */

const REQUIRED = [
  {
    key: "NEXT_PUBLIC_BASE_URL",
    why: "Baked into every pass QR code. Wrong value = scanned passes 404 at the gate.",
    validate: (v) =>
      /^https?:\/\//.test(v) || "must start with http:// or https://",
  },
  {
    key: "UPSTASH_REDIS_REST_URL",
    why: "All tickets, counters and inventory live in Upstash.",
    alt: "KV_REST_API_URL",
  },
  {
    key: "UPSTASH_REDIS_REST_TOKEN",
    why: "Upstash auth token.",
    alt: "KV_REST_API_TOKEN",
  },
  {
    key: "CASHFREE_APP_ID",
    why: "Cashfree client id. Without it no payment can be started at all.",
  },
  {
    key: "CASHFREE_SECRET_KEY",
    why: "Cashfree secret. Also signs the payment webhook — a wrong value silently rejects every confirmation.",
    validate: (v) => v.length >= 20 || "looks too short to be a Cashfree secret key",
  },
  {
    key: "SESSION_SECRET",
    why: "Signs admin session cookies.",
    validate: (v) => v.length >= 32 || "must be at least 32 characters",
  },
  {
    key: "TICKET_SIGNING_SECRET",
    why: "Signs pass QR links.",
    validate: (v) => v.length >= 32 || "must be at least 32 characters",
  },
  {
    key: "ADMIN_PASSWORD",
    why: "Protects buyer PII and the ticket admin.",
    validate: (v) => v.length >= 12 || "must be at least 12 characters",
  },
  { key: "SMTP_HOST", why: "Passes are delivered by email." },
  { key: "SMTP_USER", why: "SMTP auth." },
  { key: "SMTP_PASS", why: "SMTP auth." },
  { key: "SMTP_FROM", why: "Sender address on pass emails." },
  {
    key: "CRON_SECRET",
    // The original note here said an unset secret "leaves the cron endpoints
    // publicly callable", which is backwards — both routes refuse every
    // request when it's missing, including the scheduler's. The real cost is
    // that expiry never runs, so abandoned checkouts hold their seats forever
    // and a tier reads sold out while far fewer passes were actually sold.
    why: "Without it the cron endpoints reject ALL requests, so orders never expire and reserved seats are never returned to inventory.",
    validate: (v) => v.length >= 16 || "must be at least 16 characters",
  },
];

const RECOMMENDED = [
  { key: "GATE_PASSWORD", why: "Without it, gate crew need the full admin password." },
];

export function checkEnv() {
  const errors = [];
  const warnings = [];

  for (const item of REQUIRED) {
    const value = process.env[item.key] || (item.alt && process.env[item.alt]);
    if (!value) {
      errors.push(`${item.key} is not set — ${item.why}`);
      continue;
    }
    if (item.validate) {
      const result = item.validate(value);
      if (result !== true) errors.push(`${item.key} ${result} — ${item.why}`);
    }
  }

  for (const item of RECOMMENDED) {
    if (!process.env[item.key]) warnings.push(`${item.key} is not set — ${item.why}`);
  }

  // Production-specific traps that are easy to miss.
  if (process.env.NODE_ENV === "production") {
    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    if (base.includes("localhost")) {
      errors.push(
        "NEXT_PUBLIC_BASE_URL still points at localhost — every issued pass QR would be unusable."
      );
    }
    if (!base.startsWith("https://")) {
      errors.push("NEXT_PUBLIC_BASE_URL must be https in production (session cookies are secure-only).");
    }
  }

  // Cashfree mode. Sandbox takes test cards only — going live with it set to
  // sandbox means every "payment" is fake and no money ever arrives.
  const mode = process.env.CASHFREE_MODE || "sandbox";
  if (!["sandbox", "production"].includes(mode)) {
    errors.push(
      `CASHFREE_MODE is "${mode}" — it must be either "sandbox" or "production".`
    );
  }
  if (process.env.NODE_ENV === "production" && mode !== "production") {
    warnings.push(
      "CASHFREE_MODE is not \"production\" — payments will run against Cashfree's sandbox and no real money will be collected."
    );
  }
  if (mode === "production" && /test/i.test(process.env.CASHFREE_APP_ID || "")) {
    warnings.push(
      "CASHFREE_MODE=production but CASHFREE_APP_ID looks like a test key — check you copied the production credentials."
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}
