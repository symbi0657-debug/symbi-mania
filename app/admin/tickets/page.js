"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Download,
  Loader2,
  X,
  Mail,
  RefreshCw,
  FileSearch,
} from "lucide-react";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const FILTERS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Awaiting" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Unpaid" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const STATUS_STYLE = {
  paid: "border-[#00f0ff]/50 text-[#00f0ff]",
  submitted: "border-[#ffd166]/50 text-[#ffd166]",
  pending: "border-white/25 text-white/55",
  rejected: "border-[#ff2ed1]/50 text-[#ff8adf]",
  expired: "border-white/15 text-white/35",
};

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        STATUS_STYLE[status] || "border-white/20 text-white/50"
      }`}
    >
      {status}
    </span>
  );
}

function when(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Field({ label, value, mono }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
        {label}
      </p>
      <p className={`mt-0.5 text-sm text-white/90 ${mono ? "font-mono" : ""}`}>
        {String(value)}
      </p>
    </div>
  );
}

function TicketDrawer({ ticket, onClose, onUpdated }) {
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}/resend`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Resend failed");
      toast.success(`Pass re-sent to ${ticket.email}`);
      onUpdated(data.ticket);
    } catch (err) {
      toast.error(err.message || "Could not resend the email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="glass-strong h-full w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-sm tracking-wider text-white">{ticket.id}</p>
            <div className="mt-1.5">
              <StatusPill status={ticket.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {ticket.qrDataUrl && (
          <img
            src={ticket.qrDataUrl}
            alt="Pass QR"
            className="mx-auto my-5 h-40 w-40 rounded-xl bg-white p-2"
          />
        )}

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Name" value={ticket.name} />
          <Field label="Amount" value={inr(ticket.total)} />
          <Field label="Email" value={ticket.email} />
          <Field label="Phone" value={ticket.phone} mono />
          <Field label="Pass" value={ticket.passName} />
          <Field label="Quantity" value={ticket.quantity} />
          <Field label="Entries" value={ticket.entries} />
          {ticket.discount > 0 && (
            <Field label="Discount" value={`− ${inr(ticket.discount)}`} />
          )}
          <Field label="Order ref" value={ticket.orderRef} mono />
          <Field label="Cashfree order" value={ticket.cfOrderId} mono />
          <Field label="Referral" value={ticket.referralCode} />
          <Field label="College" value={ticket.college} />
          <Field label="Partner" value={ticket.partnerName} />
          <Field label="Partner phone" value={ticket.partnerPhone} mono />
          <Field label="Created" value={when(ticket.createdAt)} />
          <Field label="Verified by" value={ticket.verifiedBy} />
          <Field label="Verified at" value={ticket.verifiedAt && when(ticket.verifiedAt)} />
          <Field label="Checked in" value={ticket.checkedInAt && when(ticket.checkedInAt)} />
          <Field label="Checked in by" value={ticket.checkedInBy} />
          <Field label="Rejected reason" value={ticket.rejectionReason} />
          <Field label="Payment mismatch" value={ticket.paymentMismatch} />
        </div>

        {ticket.status === "paid" && (
          <>
            {ticket.emailSent === false && (
              <p className="mt-5 rounded-xl border border-[#ffd166]/40 bg-[#ffd166]/10 px-3 py-2.5 text-xs text-[#ffd166]">
                The confirmation email never went out
                {ticket.emailError ? `: ${ticket.emailError}` : "."} Resend it below.
              </p>
            )}
            <button
              onClick={resend}
              disabled={sending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Resend confirmation email
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

export default function TicketsPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (status) params.set("status", status);
      if (query) params.set("search", query);
      const res = await fetch(`/api/admin/tickets?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      setRows((await res.json()).tickets);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => {
    load();
  }, [load]);

  function patchRow(next) {
    setRows((prev) => prev.map((t) => (t.id === next.id ? next : t)));
    setSelected(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black tracking-wide">Tickets</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <a
            href="/api/admin/export"
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(term.trim());
        }}
        className="flex gap-2"
      >
        <div className="glass flex flex-1 items-center gap-2 rounded-xl px-3">
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Pass ID, order ref, email, phone or name…"
            className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/25"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                setQuery("");
              }}
              className="text-white/35 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="rounded-xl border border-white/15 px-4 text-xs font-bold text-white/70 hover:text-white"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              status === f.value
                ? "bg-white/15 text-white"
                : "border border-white/10 text-white/50 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-[#ff2ed1]/40 bg-[#ff2ed1]/10 px-4 py-3 text-xs text-[#ff8adf]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex h-52 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl px-6 py-16 text-center">
          <FileSearch className="mx-auto mb-3 h-8 w-8 text-white/20" />
          <p className="font-display text-base font-bold text-white/70">
            {query || status ? "Nothing matched" : "No tickets yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-white/35">
            {query || status
              ? "Try a different search term or clear the filters."
              : "Orders will appear here as soon as the first buyer checks out."}
          </p>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/40">
                <th className="px-4 py-3 font-bold">Pass ID</th>
                <th className="px-4 py-3 font-bold">Buyer</th>
                <th className="px-4 py-3 font-bold">Pass</th>
                <th className="px-4 py-3 text-right font-bold">Amount</th>
                <th className="px-4 py-3 font-bold">Cashfree order</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.05]"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    {t.id}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{t.name || "—"}</p>
                    <p className="text-[11px] text-white/40">{t.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-white/70">
                    {t.passName}
                    {t.quantity > 1 ? ` × ${t.quantity}` : ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {inr(t.total)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/50">
                    {t.cfOrderId || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-white/40">
                    {when(t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <TicketDrawer
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={patchRow}
        />
      )}
    </div>
  );
}
