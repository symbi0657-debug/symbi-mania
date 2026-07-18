// Simple localStorage-backed ticket cache, ported from the original.
// Real persistence + cross-device lookup now goes through /api/lookup-ticket
// (see lib/db.js on the server side) since actual payments need a durable
// record, not just the buyer's own browser storage.

const KEY = "fresho-tickets";

export function saveTicket(t) {
  if (typeof window === "undefined") return;
  const all = getAllTickets();
  all.push(t);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getAllTickets() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function findTicketLocal(query) {
  const q = query.trim().toLowerCase();
  return getAllTickets().find(
    (t) =>
      t.id.toLowerCase() === q ||
      t.email.toLowerCase() === q ||
      t.phone.replace(/\D/g, "").endsWith(q.replace(/\D/g, ""))
  );
}

export function generatePassId() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `FM3-${time}-${rand}`;
}
