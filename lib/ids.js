import crypto from "crypto";

// Crockford-ish alphabet: no I, L, O, U — so a pass ID read aloud at a noisy
// gate or typed off a cracked screen can't be ambiguous.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomChars(n) {
  // Rejection-free: 256 % 32 === 0, so a raw byte maps to the alphabet with a
  // uniform distribution. No modulo bias.
  const bytes = crypto.randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * Pass IDs are the gate credential, so they must not be guessable. The old
 * implementation was `Date.now()` + `Math.random()`, which leaked issue time
 * and was trivially enumerable — anyone could walk the ID space and pull other
 * people's passes. 40 bits of CSPRNG entropy instead.
 */
export function generatePassId() {
  return `FM3-${randomChars(4)}-${randomChars(4)}`;
}

/** Short human-quotable reference that goes in the UPI transaction note. */
export function generateOrderRef() {
  return `FM${randomChars(6)}`;
}

export function generateReferralCode(seed = "") {
  const clean = seed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return clean ? `${clean}${randomChars(2)}` : randomChars(8);
}

function secret() {
  const s = process.env.TICKET_SIGNING_SECRET;
  if (!s) throw new Error("TICKET_SIGNING_SECRET is not set");
  return s;
}

/**
 * Ticket URLs carry an HMAC so a scanned QR proves the ID was issued by us.
 * Without this, knowing the ID format is enough to mint a plausible link.
 */
export function signTicketId(id) {
  return crypto
    .createHmac("sha256", secret())
    .update(id)
    .digest("base64url")
    .slice(0, 16);
}

export function verifyTicketToken(id, token) {
  if (!token) return false;
  const expected = signTicketId(id);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
