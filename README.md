# SYMBI FRESHO Mania 3.0 — passes, Cashfree payments, admin

Next.js 14 (App Router, JavaScript) event-pass platform. Payments run through
the **Cashfree payment gateway** — UPI, cards and netbanking, confirmed
automatically. Tickets, counters and inventory live in **Upstash Redis**.

---

## How payment works

Cashfree is the source of truth for whether an order was paid. Nothing else —
not the buyer, not the return URL — can mark an order paid.

```
Buyer picks pass ──► order created, seats held 30 min ──► status: pending
       │
       └─► redirected to Cashfree's hosted page ────────► status: submitted
                    (pays by UPI / card / netbanking)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   webhook fires        buyer redirected      expiry sweeper
   (tab closed)         back, page polls      (last resort, 10 min)
        │                     │                     │
        └─────────► we ASK CASHFREE ◄───────────────┘
                    order_status === "PAID"
                              │
                     status: paid ──► QR minted + pass emailed
```

**Three independent paths reach the same check**, because each one alone has a
hole: webhooks get blocked or misconfigured, buyers close the tab before the
redirect, and both fail if Cashfree is briefly unreachable. All three funnel
into `lib/fulfill.js`, which re-reads the order from Cashfree every time and is
idempotent — whichever arrives first mints the pass, the rest are no-ops.

That idempotency is enforced by a Redis `SETNX` lock in `confirmTicketPaid`,
not by a status check, because two paths can and do observe `submitted`
simultaneously.

---

## Setup

```bash
bun install                  # or npm install
cp .env.example .env.local   # then fill it in
bun run check-env            # validates config before you take real money
bun run dev
```

### Required services

1. **Cashfree** — [merchant.cashfree.com](https://merchant.cashfree.com).
   Sign up, then **Developers → API Keys**. Copy the App ID and Secret Key into
   `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY`.
2. **Upstash Redis** — [console.upstash.com](https://console.upstash.com),
   create a database, copy the REST URL and token. Everything persists here.
3. **SMTP** — Gmail works with an
   [app password](https://myaccount.google.com/apppasswords).

### Cashfree, start to finish

1. **Sandbox first.** Leave `CASHFREE_MODE=sandbox` and paste the *sandbox* key
   pair. Sandbox and production have separate keys; mixing them gives
   `authentication Failed`.
2. **Register the webhook.** In the dashboard: **Developers → Webhooks → Add
   webhook endpoint**, URL `https://YOUR-DOMAIN/api/webhooks/cashfree`, event
   **Payment Success**. There is no extra secret to configure — the webhook is
   signed with `CASHFREE_SECRET_KEY` and verified in `lib/cashfree.js`.
3. **Test end to end** with a sandbox test card or UPI, and confirm a pass email
   arrives with a scannable QR.
4. **Go live.** Complete Cashfree's KYC, swap in the production key pair, set
   `CASHFREE_MODE=production`, and re-register the webhook against your live
   domain.

> Webhooks can't reach `localhost`. In local dev the checkout page's own polling
> (`/api/orders/[ref]/verify`) confirms the payment, so the flow works without a
> tunnel — the webhook only matters once deployed.

### Secrets

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- `SESSION_SECRET` — signs admin cookies. Rotating logs everyone out.
- `TICKET_SIGNING_SECRET` — signs pass QR links. **Never rotate after launch**;
  it invalidates the signature on every pass already emailed.
- `CRON_SECRET` — protects the expiry cron, which returns seats to inventory.

---

## Admin

Log in at `/admin/login`.

| Route | Purpose |
|---|---|
| `/admin` | Revenue, tickets sold, per-tier remaining, live activity |
| `/admin/tickets` | Search every ticket, resend email, export CSV |
| `/admin/checkin` | Gate screen — type a Pass ID, admit or reject |
| `/admin/referrals` | Promoter codes and revenue leaderboard |

There is **no verification queue** — Cashfree confirms payments, so there is
nothing for a human to approve. The manual approve/reject routes were removed
along with the old UPI flow: a button that marks an order paid without checking
the gateway is a liability once the gateway is the source of truth.

**Two passwords.** `ADMIN_PASSWORD` unlocks everything. `GATE_PASSWORD` unlocks
*only* check-in. Give volunteers the gate password — it can't see revenue or
buyer contact details.

---

## Referrals

Create a code in `/admin/referrals`, share `/checkout?ref=CODE`. Every paid
ticket attributes tickets, entries and revenue to that promoter. Codes can
carry a percentage discount or track at full price. Attribution is counted at
*confirmation*, not at order creation, so unpaid orders never inflate a
promoter's numbers.

A code worth 100% leaves nothing to charge. Cashfree rejects orders under ₹1,
so those are confirmed directly by `confirmFreeOrder` with no gateway leg.

---

## Tests

```bash
bun run test          # both suites; also runs as part of `bun run predeploy`
```

Two suites, both covering things that cost real money when they break:

- `test:webhook` — signature verification. Valid, forged, unsigned,
  tampered-body and replayed-timestamp payloads.
- `test:races` — runs the real `confirmTicketPaid` and `expireUnpaidOrder`
  concurrently against an in-memory fake of Upstash, with the SETNX deliberately
  slowed to widen the race window. Asserts an order can never end up both paid
  and expired, that revenue and referral counters increment exactly once under
  8 concurrent confirmations, and that an orphaned lock never reads as paid.

The race suite is written to fail if the locking is removed — deleting the
`claimTerminal` guard in `expireUnpaidOrder` reproduces the original bug
(confirm and expire both succeeding) and the suite catches it.

---

## Going-live checklist

- [ ] `bun run check-env` passes with no errors
- [ ] `NEXT_PUBLIC_BASE_URL` is your real **https** domain — it is baked into
      every pass QR *and* is where Cashfree returns buyers after payment
- [ ] `CASHFREE_MODE=production` and the **production** key pair is in place
- [ ] Webhook registered at `https://YOUR-DOMAIN/api/webhooks/cashfree`
      (Payment Success) — check the dashboard shows a 200 after a test payment
- [ ] Capacities in `lib/event-config.js` match what the venue actually holds
- [ ] **One real end-to-end test**: buy a pass with a real ₹1 payment, confirm
      the email arrives with a QR that scans, check it in at `/admin/checkin`,
      and confirm a second scan is rejected
- [ ] Gate crew have `GATE_PASSWORD`, not `ADMIN_PASSWORD`
- [ ] Cron configured (see `vercel.json`) so abandoned checkouts release seats

### Event-night runbook

**Buyer paid but has no pass** → `/admin/tickets`, search their email or Pass
ID. If status is `submitted`, the webhook hasn't landed; the expiry sweeper
re-checks Cashfree within 10 minutes and issues the pass automatically. To force
it now, have the buyer reopen `/checkout?order_ref=THEIR_REF`, which re-polls
Cashfree immediately. Cross-check the charge in the Cashfree dashboard by
searching `FM3-<order ref>`.

**Ticket shows "payment mismatch"** → Cashfree captured an amount that doesn't
match the order total. The pass is deliberately not issued. Check the dashboard
and refund or issue manually.

**"Already used" at the gate** → the pass was scanned before. The screen shows
when and by whom. Either they're re-entering, or someone forwarded them a
screenshot. Your call.

**Email not arriving** → hit Resend in `/admin/tickets`. Confirmation and email
are deliberately decoupled: an SMTP failure never un-confirms a paid ticket.

**Upstash down** → nothing persists. Stop selling, put up a notice. Don't take
payments you can't record.

---

## Security notes

- Prices are computed server-side from `lib/event-config.js`; the client's
  numbers are never trusted.
- Inventory is reserved with an atomic `INCRBY`-then-check, so concurrent
  buyers can't oversell a tier.
- Cashfree webhooks are HMAC-verified against `CASHFREE_SECRET_KEY` with a
  timestamp freshness window, so the endpoint can't be forged or replayed.
- A payment is only ever confirmed by re-reading the order from Cashfree; the
  webhook body and the return URL are treated as untrusted hints.
- The captured amount is checked against the stored total before a pass is
  issued, so a tampered order can't be underpaid into validity.
- An order can only be confirmed once (`SETNX`), so the three confirmation paths
  can't double-count revenue or referral commission.
- Pass IDs are CSPRNG-generated and QR links are HMAC-signed, so the pass space
  can't be enumerated.
- Ticket lookup never returns a pass from a phone number or email — it re-sends
  to the address on file instead. Indian mobile numbers are a small, guessable
  space; the previous behaviour let anyone harvest the attendee list.
- Admin login is rate-limited; all public endpoints are rate-limited.
- CSP, HSTS and frame-deny headers are set in `next.config.js`.

---

## Deployment

Deploys to Vercel or any Node host — there is no filesystem dependency
(the old `data/tickets.json` store is gone; Upstash replaced it).

```bash
bun run build && bun run start
```

Set every variable from `.env.example` in your host's environment settings.
`.env.local` is gitignored and must never be committed.
