import { Redis } from "@upstash/redis";
import { PASS_TIERS, getTier, TICKET_STATUS } from "./event-config";

/*
 * Upstash Redis key map
 * ────────────────────────────────────────────────────────────────────────────
 *  t:<id>                  JSON ticket record
 *  t:index                 ZSET  id → createdAt(ms)      ordered listing + ZCARD
 *  t:status:<status>       SET   ids in that status      verification queue
 *  t:ref:<orderRef>        STR   orderRef → id           UPI note lookup
 *  t:utr:<utr>             STR   utr → id                blocks UTR reuse
 *  t:email:<email>         SET   ids                     buyer self-lookup
 *  t:phone:<last10>        SET   ids                     buyer self-lookup
 *
 *  sold:<passId>           INT   entries currently held or sold (atomic gate)
 *
 *  stats:orders            INT   orders ever created
 *  stats:paid              INT   tickets confirmed paid
 *  stats:entries           INT   entries confirmed paid
 *  stats:revenue           INT   rupees confirmed paid
 *  stats:checkedin         INT   passes admitted at the gate
 *
 *  ref:<code>              JSON promoter record
 *  ref:index               SET   all promoter codes
 *  ref:count:<code>        INT   paid tickets attributed
 *  ref:entries:<code>      INT   paid entries attributed
 *  ref:revenue:<code>      INT   rupees attributed
 *
 *  audit                   LIST  admin action log (capped at 1000)
 *  rl:<bucket>:<key>       INT   rate-limit window counter
 */

let _redis = null;

/**
 * Lazily constructed so importing this module can't throw at build time when
 * env vars are absent. `Redis.fromEnv()` at module scope was why every payment
 * verification 500'd: the import blew up before the handler ever ran.
 */
export function redis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export function isRedisConfigured() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
}

const normEmail = (e) => String(e || "").trim().toLowerCase();
const normPhone = (p) => String(p || "").replace(/\D/g, "").slice(-10);

/* ── Inventory ───────────────────────────────────────────────────────────── */

/**
 * Reserve `entries` seats for a tier, atomically.
 *
 * INCRBY returns the post-increment value, so check-after-increment is
 * race-free: two concurrent buyers get different totals and only the one that
 * stays within capacity keeps its seats; the loser's are handed straight back.
 * A read-then-write here would oversell under load, which at a real door means
 * turning away someone holding a paid pass.
 */
export async function reserveSeats(passId, entries) {
  const tier = getTier(passId);
  if (!tier) return { ok: false, reason: "unknown_tier" };

  const after = await redis().incrby(`sold:${passId}`, entries);
  if (after > tier.capacity) {
    await redis().decrby(`sold:${passId}`, entries);
    return {
      ok: false,
      reason: "sold_out",
      left: Math.max(0, tier.capacity - (after - entries)),
    };
  }
  return { ok: true, left: tier.capacity - after };
}

/** Hand seats back when an order is rejected or expires. */
export async function releaseSeats(passId, entries) {
  const after = await redis().decrby(`sold:${passId}`, entries);
  // Defensive: a double-release would drive this negative and silently inflate
  // available inventory. Clamp rather than let the counter drift.
  if (after < 0) await redis().set(`sold:${passId}`, 0);
}

/**
 * Release an order's seats AT MOST ONCE, ever.
 *
 * Three independent code paths can decide an order is dead — the reject route,
 * the UTR-submission expiry check, and the cron sweeper — and each previously
 * guarded only against itself. So an order that the cron expired and an admin
 * then rejected returned its seats twice, decrementing `sold:` below the true
 * held count and letting the tier oversell by exactly that much. The clamp in
 * releaseSeats() only stops the counter going negative; it does not stop a
 * legitimately-held 100 dropping to 90.
 *
 * SETNX on a per-ticket marker makes "have these seats already gone back?" a
 * single atomic question, whoever is asking.
 */
export async function releaseSeatsOnce(ticket) {
  if (!ticket?.id || !ticket.passId) return { released: false, reason: "invalid" };
  const claimed = await redis().set(`t:released:${ticket.id}`, new Date().toISOString(), {
    nx: true,
  });
  if (claimed !== "OK") return { released: false, reason: "already_released" };

  const entries = Number(ticket.entries) || Number(ticket.quantity) || 0;
  if (entries > 0) await releaseSeats(ticket.passId, entries);
  return { released: true, entries };
}

export async function getInventory() {
  const sold = await redis().mget(...PASS_TIERS.map((t) => `sold:${t.id}`));
  return PASS_TIERS.map((t, i) => {
    const used = Number(sold[i] || 0);
    return {
      id: t.id,
      name: t.name,
      price: t.price,
      capacity: t.capacity,
      sold: used,
      left: Math.max(0, t.capacity - used),
    };
  });
}

/* ── Tickets ─────────────────────────────────────────────────────────────── */

export async function createTicket(ticket) {
  // multi() (MULTI/EXEC), not pipeline(): pipeline only batches, so a partial
  // apply could write t:<id> without t:ref:<orderRef>. The buyer would then pay
  // with that reference in their UPI note and get "order not found" when
  // submitting the UTR — money sent, no recoverable order.
  const p = redis().multi();
  p.set(`t:${ticket.id}`, ticket);
  p.set(`t:ref:${ticket.orderRef}`, ticket.id);
  p.zadd("t:index", {
    score: new Date(ticket.createdAt).getTime(),
    member: ticket.id,
  });
  p.sadd(`t:status:${ticket.status}`, ticket.id);
  p.sadd(`t:email:${normEmail(ticket.email)}`, ticket.id);
  p.sadd(`t:phone:${normPhone(ticket.phone)}`, ticket.id);
  p.incr("stats:orders");
  await p.exec();
  return ticket;
}

export async function getTicketById(id) {
  if (!id) return null;
  return (await redis().get(`t:${id}`)) || null;
}

export async function getTicketByOrderRef(ref) {
  if (!ref) return null;
  const id = await redis().get(`t:ref:${String(ref).toUpperCase()}`);
  return id ? getTicketById(id) : null;
}

export async function getTicketByUtr(utr) {
  const id = await redis().get(`t:utr:${String(utr).trim()}`);
  return id ? getTicketById(id) : null;
}

/**
 * Claim a UTR for an order. SETNX makes this the single source of truth for
 * "has this bank reference already been used" — two buyers pasting the same
 * payment screenshot can't both walk away with a pass.
 */
export async function claimUtr(utr, ticketId) {
  const ok = await redis().set(`t:utr:${String(utr).trim()}`, ticketId, {
    nx: true,
  });
  return ok === "OK";
}

export async function releaseUtr(utr) {
  if (utr) await redis().del(`t:utr:${String(utr).trim()}`);
}

/** Persist a ticket update, keeping the status index consistent. */
export async function updateTicket(id, patch) {
  const current = await getTicketById(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };

  // Atomic so the record and its status index can't disagree — a ticket in
  // t:status:submitted that reads "paid" would sit in the verify queue forever.
  const p = redis().multi();
  p.set(`t:${id}`, next);
  if (patch.status && patch.status !== current.status) {
    p.srem(`t:status:${current.status}`, id);
    p.sadd(`t:status:${patch.status}`, id);
  }
  await p.exec();
  return next;
}

export async function listTicketsByStatus(status) {
  return hydrate(await redis().smembers(`t:status:${status}`));
}

/** Newest-first page of tickets. */
export async function listTickets({ offset = 0, limit = 50 } = {}) {
  const ids = await redis().zrange("t:index", offset, offset + limit - 1, {
    rev: true,
  });
  return hydrate(ids);
}

async function hydrate(ids) {
  if (!ids || ids.length === 0) return [];
  const rows = await redis().mget(...ids.map((id) => `t:${id}`));
  return rows.filter(Boolean);
}

/** Every ticket, newest first — for CSV export and the gate roster. */
export async function listAllTickets() {
  const ids = await redis().zrange("t:index", 0, -1, { rev: true });
  const out = [];
  // Chunked so a few thousand tickets don't become one oversized MGET.
  for (let i = 0; i < ids.length; i += 100) {
    out.push(...(await hydrate(ids.slice(i, i + 100))));
  }
  return out;
}

export async function findTicketsByEmail(email) {
  return hydrate(await redis().smembers(`t:email:${normEmail(email)}`));
}

export async function findTicketsByPhone(phone) {
  return hydrate(await redis().smembers(`t:phone:${normPhone(phone)}`));
}

/* ── Confirmation ────────────────────────────────────────────────────────── */

/**
 * Mark a ticket paid and roll the stat counters. Guarded so double-approval
 * (admin double-clicks, or the IMAP worker races the admin) can't double-count
 * revenue or double-credit a promoter.
 */
/**
 * Claim the right to move an order into a terminal state.
 *
 * PAID and EXPIRED are both terminal and mutually exclusive, and they are
 * decided by different actors (the gateway confirmation paths vs the expiry
 * sweeper) that race each other by design. One SETNX arbitrates both, so an
 * order can never be confirmed and expired — the outcome that leaves a buyer
 * holding an emailed pass for a seat that was resold.
 *
 * Deliberately never expires and is never released on the success path: the
 * transition it guards is permanent.
 */
async function claimTerminal(id, by) {
  return (
    (await redis().set(`t:paidlock:${id}`, String(by || "?"), { nx: true })) ===
    "OK"
  );
}

/**
 * Expire an order that the gateway says was not paid, releasing its seats.
 *
 * Takes the same lock as confirmTicketPaid, which is the whole point: the
 * sweeper decides "unpaid" from a Cashfree read that is already milliseconds
 * stale, and a webhook can confirm the order during that window. Without the
 * lock, the sweeper's blind `updateTicket` would overwrite a just-confirmed
 * PAID order back to EXPIRED — counters already incremented, pass already
 * emailed, seat back on sale, buyer refused at the gate.
 */
export async function expireUnpaidOrder(id, { by = "auto:expiry-sweeper" } = {}) {
  const t = await getTicketById(id);
  if (!t) return { ok: false, reason: "not_found" };
  if (t.status === TICKET_STATUS.PAID)
    return { ok: false, reason: "already_paid", ticket: t };

  if (!(await claimTerminal(id, by))) {
    // Someone else got there first — almost always a confirmation landing in
    // the gap. Leave the order and its seats alone.
    return { ok: false, reason: "locked", ticket: await getTicketById(id) };
  }

  const next = await updateTicket(id, {
    status: TICKET_STATUS.EXPIRED,
    expiredAt: new Date().toISOString(),
    expiredBy: by,
  });

  const released = await releaseSeatsOnce(next);
  return { ok: true, ticket: next, released };
}

export async function confirmTicketPaid(id, { verifiedBy, utr, allowFrom }) {
  const t = await getTicketById(id);
  if (!t) return { ok: false, reason: "not_found" };
  if (t.status === TICKET_STATUS.PAID)
    return { ok: false, reason: "already_paid", ticket: t };

  // Only a payment that was actually submitted may be confirmed. Without this,
  // approving an EXPIRED order mints a pass whose seats have already gone back
  // into the pool — a guaranteed oversell of one — and approving a PENDING
  // order issues a pass for money nobody ever claimed to have sent.
  const permitted = allowFrom || [TICKET_STATUS.SUBMITTED];
  if (!permitted.includes(t.status)) {
    return { ok: false, reason: "bad_status", status: t.status, ticket: t };
  }

  /*
   * The status read above and the counter writes below are separate round
   * trips, so the read alone is NOT a guard: the webhook, the buyer's return
   * poll and the expiry sweeper can all observe `submitted`, all pass, and all
   * increment — inflating revenue and over-crediting a promoter whose
   * commission is paid off `ref:revenue`. SETNX makes exactly one caller the
   * winner. It also arbitrates against the sweeper's EXPIRE transition (see
   * expireUnpaidOrder), so an order can never be both paid and expired.
   */
  const claim = await claimTerminal(id, verifiedBy);
  if (!claim) {
    /*
     * Lost the race. WHO won decides what this means, so re-read rather than
     * assuming "already paid" — the sweeper may have taken the same lock to
     * expire this order, and reporting that as paid would hand the buyer a
     * success screen for a pass that was never issued.
     */
    const fresh = await getTicketById(id);
    if (fresh?.status === TICKET_STATUS.PAID)
      return { ok: false, reason: "already_paid", ticket: fresh };
    return { ok: false, reason: "locked", status: fresh?.status, ticket: fresh };
  }

  let next;
  try {
    next = await updateTicket(id, {
      status: TICKET_STATUS.PAID,
      utr: utr || t.utr,
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    /*
     * We hold the lock but never wrote the status. Releasing it is essential:
     * the lock is the ONLY thing that can confirm this order, so leaving it
     * held would brick the order forever — every later attempt would bounce off
     * a lock whose owner is dead, while the buyer's money sits captured.
     */
    try {
      await redis().del(`t:paidlock:${id}`);
    } catch (releaseErr) {
      console.error("confirmTicketPaid: lock release failed for", id, releaseErr);
    }
    throw err;
  }

  // Atomic: a half-applied batch would leave revenue and ticket counts
  // disagreeing on the dashboard with no way to tell which is right.
  const p = redis().multi();
  p.incr("stats:paid");
  p.incrby("stats:entries", next.entries);
  p.incrby("stats:revenue", next.total);
  if (next.referralCode) {
    p.incr(`ref:count:${next.referralCode}`);
    p.incrby(`ref:entries:${next.referralCode}`, next.entries);
    p.incrby(`ref:revenue:${next.referralCode}`, next.total);
  }
  await p.exec();

  return { ok: true, ticket: next };
}

export async function checkInTicket(id, { by }) {
  const t = await getTicketById(id);
  if (!t) return { ok: false, reason: "not_found" };
  if (t.status !== TICKET_STATUS.PAID)
    return { ok: false, reason: "not_paid", ticket: t };
  if (t.checkedInAt) return { ok: false, reason: "already_used", ticket: t };

  const next = await updateTicket(id, {
    checkedInAt: new Date().toISOString(),
    checkedInBy: by,
  });
  await redis().incr("stats:checkedin");
  return { ok: true, ticket: next };
}

/* ── Stats ───────────────────────────────────────────────────────────────── */

export async function getStats() {
  const r = redis();
  const [orders, paid, entries, revenue, checkedin] = await r.mget(
    "stats:orders",
    "stats:paid",
    "stats:entries",
    "stats:revenue",
    "stats:checkedin"
  );
  const [pending, submitted, rejected, expired, total] = await Promise.all([
    r.scard(`t:status:${TICKET_STATUS.PENDING}`),
    r.scard(`t:status:${TICKET_STATUS.SUBMITTED}`),
    r.scard(`t:status:${TICKET_STATUS.REJECTED}`),
    r.scard(`t:status:${TICKET_STATUS.EXPIRED}`),
    r.zcard("t:index"),
  ]);

  return {
    orders: Number(orders || 0),
    paid: Number(paid || 0),
    entries: Number(entries || 0),
    revenue: Number(revenue || 0),
    checkedIn: Number(checkedin || 0),
    pending: Number(pending || 0),
    awaitingVerification: Number(submitted || 0),
    rejected: Number(rejected || 0),
    expired: Number(expired || 0),
    totalOrders: Number(total || 0),
  };
}

/* ── Referrals ───────────────────────────────────────────────────────────── */

export async function createReferral({ code, promoter, phone, discount = 0, note }) {
  const key = String(code).toUpperCase();
  const record = {
    code: key,
    promoter,
    phone: phone || "",
    discount: Math.max(0, Math.min(100, Number(discount) || 0)),
    note: note || "",
    active: true,
    createdAt: new Date().toISOString(),
  };
  const created = await redis().set(`ref:${key}`, record, { nx: true });
  if (created !== "OK") return { ok: false, reason: "exists" };
  await redis().sadd("ref:index", key);
  return { ok: true, referral: record };
}

export async function getReferral(code) {
  if (!code) return null;
  return (await redis().get(`ref:${String(code).toUpperCase()}`)) || null;
}

export async function updateReferral(code, patch) {
  const key = String(code).toUpperCase();
  const current = await getReferral(key);
  if (!current) return null;
  const next = { ...current, ...patch, code: key };
  await redis().set(`ref:${key}`, next);
  return next;
}

export async function deleteReferral(code) {
  const key = String(code).toUpperCase();
  const p = redis().pipeline();
  p.del(`ref:${key}`);
  p.srem("ref:index", key);
  // The attribution counters must go too. Leaving them behind means a promoter
  // code that is deleted and later re-created inherits the old one's ticket
  // count and revenue — a silent payout error.
  p.del(`ref:count:${key}`);
  p.del(`ref:entries:${key}`);
  p.del(`ref:revenue:${key}`);
  await p.exec();
}

/** Promoter leaderboard, best-selling first. */
export async function listReferrals() {
  const codes = await redis().smembers("ref:index");
  if (!codes.length) return [];

  const r = redis();
  const [records, counts, entries, revenues] = await Promise.all([
    r.mget(...codes.map((c) => `ref:${c}`)),
    r.mget(...codes.map((c) => `ref:count:${c}`)),
    r.mget(...codes.map((c) => `ref:entries:${c}`)),
    r.mget(...codes.map((c) => `ref:revenue:${c}`)),
  ]);

  return records
    .map((rec, i) =>
      rec
        ? {
            ...rec,
            tickets: Number(counts[i] || 0),
            entries: Number(entries[i] || 0),
            revenue: Number(revenues[i] || 0),
          }
        : null
    )
    .filter(Boolean)
    .sort((a, b) => b.revenue - a.revenue);
}

/* ── Audit log ───────────────────────────────────────────────────────────── */

export async function audit(action, detail = {}) {
  try {
    const p = redis().pipeline();
    p.lpush("audit", { action, detail, at: new Date().toISOString() });
    p.ltrim("audit", 0, 999);
    await p.exec();
  } catch {
    // Losing an audit line must never fail the operation it describes.
  }
}

export async function listAudit(limit = 100) {
  return (await redis().lrange("audit", 0, limit - 1)) || [];
}
