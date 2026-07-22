// Client-side convenience cache only.
//
// The authoritative record lives in Upstash (see lib/db.js). This exists so a
// buyer's own device can re-display a pass instantly without a round trip; it
// is never trusted for anything.
//
// Two functions were deleted from this file rather than kept:
//
//   generatePassId()  — minted IDs from Date.now() + Math.random(). Pass IDs
//                       are now the gate credential and are issued server-side
//                       from a CSPRNG (lib/ids.js). A second, weaker generator
//                       sitting in client code is an invitation to use it.
//   findTicketLocal() — matched on a phone-number suffix, so on a shared device
//                       it could surface someone else's cached pass.

const KEY = "fresho-tickets";

export function saveTicket(t) {
  if (typeof window === "undefined") return;
  try {
    const all = getAllTickets().filter((x) => x.id !== t.id);
    all.push(t);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Private browsing and full-quota storage both throw here. Losing a local
    // cache entry is harmless — the pass is safe on the server and in email.
  }
}

export function getAllTickets() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
