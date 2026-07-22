/**
 * Proves the paid/expired race is actually closed, by running the real
 * confirmTicketPaid and expireUnpaidOrder concurrently against a fake Upstash
 * whose SET NX is deliberately slowed to widen the window.
 */
import { start, control, store } from "./fake-upstash.mjs";

const { port } = await start();
process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${port}`;
process.env.UPSTASH_REDIS_REST_TOKEN = "faketoken";

const db = await import("../lib/db.js");
const { TICKET_STATUS } = await import("../lib/event-config.js");

let pass = 0, fail = 0;
const t = (name, cond, extra = "") => {
  (cond ? pass++ : fail++);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra && !cond ? "  → " + extra : ""}`);
};

async function makeTicket(id, status = TICKET_STATUS.SUBMITTED) {
  await db.createTicket({
    id, orderRef: "FM" + id, status, passId: "male", passName: "Male Pass",
    quantity: 1, entries: 1, subtotal: 500, discount: 0, total: 500,
    name: "T", email: `${id}@e.com`, phone: "9876543210",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  // createTicket writes status pending; force the one we want.
  if (status !== TICKET_STATUS.PENDING) await db.updateTicket(id, { status });
}

// ── 1. Confirm and expire fired concurrently ────────────────────────────────
await makeTicket("RACE01");
control.delayMs = 0;
control.onSetNx = async () => { await new Promise((r) => setTimeout(r, 25)); };

const [conf, exp] = await Promise.all([
  db.confirmTicketPaid("RACE01", { verifiedBy: "cashfree:webhook", allowFrom: [TICKET_STATUS.PENDING, TICKET_STATUS.SUBMITTED] }),
  db.expireUnpaidOrder("RACE01"),
]);
control.onSetNx = null;

const after = await db.getTicketById("RACE01");
t("exactly one of confirm/expire succeeds", (conf.ok ? 1 : 0) + (exp.ok ? 1 : 0) === 1,
  `confirm.ok=${conf.ok} expire.ok=${exp.ok}`);
t("final status is terminal and consistent with the winner",
  (conf.ok && after.status === TICKET_STATUS.PAID) || (exp.ok && after.status === TICKET_STATUS.EXPIRED),
  `status=${after.status}`);
t("order is never both paid and expired", after.status !== undefined && [TICKET_STATUS.PAID, TICKET_STATUS.EXPIRED].includes(after.status));

// ── 2. Revenue counted only when the confirm actually won ───────────────────
const revenue = Number(store.get("stats:revenue") ?? 0);
t("revenue counted iff confirm won", conf.ok ? revenue === 500 : revenue === 0, `revenue=${revenue}`);

// ── 3. Many concurrent confirms → one winner, counted once ──────────────────
await makeTicket("RACE02");
const many = await Promise.all(
  Array.from({ length: 8 }, (_, i) =>
    db.confirmTicketPaid("RACE02", { verifiedBy: "c" + i, allowFrom: [TICKET_STATUS.PENDING, TICKET_STATUS.SUBMITTED] })
  )
);
const winners = many.filter((r) => r.ok).length;
t("8 concurrent confirms → exactly 1 winner", winners === 1, `winners=${winners}`);
const rev2 = Number(store.get("stats:revenue") ?? 0);
t("revenue incremented exactly once for RACE02", rev2 === (conf.ok ? 1000 : 500), `revenue=${rev2}`);
t("stats:paid not double counted", Number(store.get("stats:paid") ?? 0) === (conf.ok ? 2 : 1));

// ── 4. Expire cannot resurrect / overwrite an already-PAID order ────────────
const exp2 = await db.expireUnpaidOrder("RACE02");
const after2 = await db.getTicketById("RACE02");
t("expire refuses an already-paid order", exp2.ok === false && exp2.reason === "already_paid");
t("paid order stays paid after an expire attempt", after2.status === TICKET_STATUS.PAID, `status=${after2.status}`);

// ── 5. Orphaned lock must NOT read as paid ──────────────────────────────────
await makeTicket("RACE03");
// Simulate a confirm that took the lock and died before writing status.
store.set("t:paidlock:RACE03", "crashed-worker");
const orphan = await db.confirmTicketPaid("RACE03", { verifiedBy: "later", allowFrom: [TICKET_STATUS.PENDING, TICKET_STATUS.SUBMITTED] });
t("orphaned lock reports 'locked', not 'already_paid'", orphan.ok === false && orphan.reason === "locked",
  `reason=${orphan.reason}`);
const t3 = await db.getTicketById("RACE03");
t("orphan-locked ticket is not PAID", t3.status !== TICKET_STATUS.PAID, `status=${t3.status}`);

// ── 6. Seats released exactly once on expiry ────────────────────────────────
await makeTicket("RACE04");
await db.reserveSeats("male", 1);
const soldBefore = Number(store.get("sold:male") ?? 0);
await db.expireUnpaidOrder("RACE04");
await db.expireUnpaidOrder("RACE04");
const soldAfter = Number(store.get("sold:male") ?? 0);
t("double expiry releases the seat only once", soldBefore - soldAfter === 1, `before=${soldBefore} after=${soldAfter}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
