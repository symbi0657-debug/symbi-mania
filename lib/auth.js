/**
 * Admin session handling.
 *
 * Uses Web Crypto (not node:crypto) throughout, because `middleware.js` runs on
 * the Edge runtime where node:crypto isn't available. Same code therefore works
 * in middleware, route handlers, and server components.
 */

export const SESSION_COOKIE = "fm3_admin";
const SESSION_HOURS = 12;

export const ROLES = { ADMIN: "admin", GATE: "gate" };

function enc(s) {
  return new TextEncoder().encode(s);
}

function b64url(bytes) {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return s;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    enc(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Constant-time string compare — avoids leaking the password via timing. */
export function safeEqual(a, b) {
  const ba = enc(String(a));
  const bb = enc(String(b));
  // Compare lengths without early-return by folding length mismatch into the
  // accumulator; the loop still runs over a fixed span.
  let diff = ba.length ^ bb.length;
  const n = Math.max(ba.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function createSession(role) {
  const payload = {
    role,
    iat: Date.now(),
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
  };
  const body = b64url(enc(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc(body));
  return `${body}.${b64url(sig)}`;
}

/** Returns the session payload, or null if absent / tampered / expired. */
export async function readSession(token) {
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let valid;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      unb64url(sig),
      enc(body)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};

/**
 * Check a submitted password against the configured admin / gate passwords.
 * Returns the granted role, or null.
 */
export function roleForPassword(password) {
  const admin = process.env.ADMIN_PASSWORD;
  const gate = process.env.GATE_PASSWORD;
  if (admin && safeEqual(password, admin)) return ROLES.ADMIN;
  if (gate && safeEqual(password, gate)) return ROLES.GATE;
  return null;
}

/** Route-handler guard. Returns the session or null. */
export async function requireSession(req, role) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) return null;
  // Admins can do anything a gate user can; the reverse is not true.
  if (role === ROLES.ADMIN && session.role !== ROLES.ADMIN) return null;
  return session;
}
