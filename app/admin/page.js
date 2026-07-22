"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IndianRupee,
  Ticket,
  Users,
  Clock,
  ScanLine,
  ArrowRight,
  Loader2,
  Activity,
  Megaphone,
} from "lucide-react";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function relative(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACTION_LABELS = {
  admin_login: "Signed in",
  admin_login_failed: "Failed sign-in",
  ticket_approved: "Approved",
  ticket_rejected: "Rejected",
  ticket_email_resent: "Email resent",
  checkin_ok: "Admitted",
  checkin_duplicate: "Duplicate scan",
  checkin_unpaid: "Unpaid scan",
  referral_created: "Code created",
  referral_updated: "Code updated",
  referral_deleted: "Code deleted",
  tickets_exported: "CSV exported",
  order_created: "Order created",
  utr_submitted: "UTR submitted",
};

function Stat({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-white/45">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
          {label}
        </span>
      </div>
      <p
        className={`mt-2 font-display text-2xl font-black tabular-nums ${accent || "text-white"}`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-white/35">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      setData(await res.json());
      setError("");
    } catch (err) {
      setError(err.message || "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-sm text-white/60">{error}</p>
        <button
          onClick={load}
          className="mt-4 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/70 hover:text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const { stats, inventory, activity, topPromoters = [], promoterCount = 0 } = data;
  const queue = stats.awaitingVerification;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-xl font-black tracking-wide">Dashboard</h1>
        <span className="text-[10px] uppercase tracking-[0.15em] text-white/30">
          Auto-refreshes every 30s
        </span>
      </div>

      {/* Informational, not a work queue. Cashfree confirms payments on its
          own, so nobody has to action these — they are buyers currently sitting
          on the payment page, and the expiry sweeper resolves every one of them
          within the hold window. */}
      <Link
        href="/admin/tickets"
        className="glass block rounded-2xl p-5 transition hover:border-white/20"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">
              <Clock className="h-3.5 w-3.5" /> Checkouts in progress
            </p>
            <p className="mt-1.5 font-display text-4xl font-black tabular-nums text-white/70">
              {queue}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {queue > 0
                ? `${queue} ${queue === 1 ? "buyer is" : "buyers are"} on the payment page. Confirmed automatically — no action needed.`
                : "No checkouts in flight."}
            </p>
          </div>
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-4 py-2 text-xs font-bold">
            View <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          icon={IndianRupee}
          label="Revenue"
          value={inr(stats.revenue)}
          sub="Confirmed paid"
          accent="text-[#00f0ff]"
        />
        <Stat
          icon={Ticket}
          label="Tickets paid"
          value={stats.paid}
          sub={`${stats.totalOrders} orders total`}
        />
        <Stat icon={Users} label="Entries" value={stats.entries} sub="Heads at the door" />
        <Stat
          icon={ScanLine}
          label="Checked in"
          value={stats.checkedIn}
          sub={
            stats.entries
              ? `${Math.round((stats.checkedIn / stats.entries) * 100)}% of entries`
              : "Gate not open yet"
          }
        />
        <Stat
          icon={Clock}
          label="Unpaid / lapsed"
          value={stats.pending + stats.expired}
          sub={`${stats.rejected} rejected`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">
            Inventory
          </h2>
          <div className="space-y-4">
            {inventory.map((t) => {
              const pct = t.capacity
                ? Math.min(100, Math.round((t.sold / t.capacity) * 100))
                : 0;
              return (
                <div key={t.id}>
                  <div className="mb-1.5 flex items-baseline justify-between text-xs">
                    <span className="font-semibold">{t.name}</span>
                    <span className="tabular-nums text-white/45">
                      {t.sold} / {t.capacity}
                      <span
                        className={`ml-2 font-semibold ${
                          t.left === 0 ? "text-[#ff2ed1]" : "text-white/70"
                        }`}
                      >
                        {t.left === 0 ? "SOLD OUT" : `${t.left} left`}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="bg-holo h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Who is actually selling. Attribution counts only on CONFIRMED
            payments, so these numbers are money in the bank, not orders
            started — which is what you'd pay commission on. */}
        <section className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">
              <Megaphone className="h-3.5 w-3.5" /> Top sellers
            </h2>
            <Link
              href="/admin/referrals"
              className="text-[10px] uppercase tracking-wider text-white/40 transition hover:text-white"
            >
              All {promoterCount > 0 ? `(${promoterCount})` : ""} →
            </Link>
          </div>
          {topPromoters.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/30">
              {promoterCount === 0
                ? "No promoter codes yet. Create one in Referrals and share its link."
                : "No attributed sales yet — codes exist but nobody has bought through one."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {topPromoters.map((p, i) => (
                <li
                  key={p.code}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-xs odd:bg-white/[0.03]"
                >
                  <span className="w-4 shrink-0 tabular-nums text-white/30">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white/90">
                      {p.promoter}
                    </p>
                    <p className="font-mono text-[10px] tracking-wider text-white/35">
                      {p.code}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold tabular-nums text-[#00f0ff]">
                      {inr(p.revenue)}
                    </p>
                    <p className="text-[10px] tabular-nums text-white/40">
                      {p.tickets} {p.tickets === 1 ? "ticket" : "tickets"} ·{" "}
                      {p.entries}{" "}
                      {p.entries === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">
            <Activity className="h-3.5 w-3.5" /> Recent activity
          </h2>
          {activity.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/30">
              Nothing has happened yet. Actions you take will show up here.
            </p>
          ) : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {activity.map((a, i) => (
                <li
                  key={`${a.at}-${i}`}
                  className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-xs odd:bg-white/[0.03]"
                >
                  <span className="font-semibold text-white/80">
                    {ACTION_LABELS[a.action] || a.action}
                  </span>
                  <span className="truncate font-mono text-[10px] text-white/35">
                    {a.detail?.id || a.detail?.code || a.detail?.role || ""}
                  </span>
                  <span className="shrink-0 text-[10px] text-white/30">
                    {relative(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
