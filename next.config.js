/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

/*
 * Cashfree's checkout needs to be reachable from our origin, and every one of
 * these directives blocks a different part of it if omitted:
 *   script-src   — the SDK itself (sdk.cashfree.com)
 *   connect-src  — the SDK's XHR to the payments API while it prepares the session
 *   frame-src    — the flows Cashfree renders in an iframe (cards, some UPI banks)
 *   form-action  — the POST that actually navigates the buyer to the hosted page
 * Scoped to Cashfree rather than opened to '*': this is the payment path, so a
 * wildcard here would be the single worst place in the app to have one.
 */
const CASHFREE_ORIGINS = "https://*.cashfree.com";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    // No camera needed: check-in is manual Pass ID entry. `payment=(self)`
    // because the Cashfree SDK may use the Payment Request API on our page —
    // the old `payment=()` silently disabled it.
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next's client runtime needs inline, and eval in dev only.
      `script-src 'self' 'unsafe-inline' ${CASHFREE_ORIGINS}${
        isDev ? " 'unsafe-eval'" : ""
      }`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // data:/blob: cover the QR and pass images we generate client-side.
      `img-src 'self' data: blob: ${CASHFREE_ORIGINS}`,
      "media-src 'self'",
      `connect-src 'self' ${CASHFREE_ORIGINS}`,
      `frame-src 'self' ${CASHFREE_ORIGINS}`,
      `form-action 'self' ${CASHFREE_ORIGINS}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
