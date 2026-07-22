"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  CheckCheck,
  Trash2,
  Loader2,
  Megaphone,
  Power,
} from "lucide-react";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function CopyLink({ code }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const link = `${window.location.origin}/checkout?ref=${code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy this link:", link);
      return;
    }
    setCopied(true);
    toast.success("Share link copied");
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      onClick={copy}
      title="Copy share link"
      className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
    >
      {copied ? (
        <CheckCheck className="h-4 w-4 text-[#00f0ff]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

export default function ReferralsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ promoter: "", code: "", discount: "", phone: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/referrals", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      setRows((await res.json()).referrals);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load referral codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promoter: form.promoter,
          code: form.code,
          phone: form.phone,
          discount: Number(form.discount) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create that code.");

      setRows((prev) => [...prev, data.referral]);
      setForm({ promoter: "", code: "", discount: "", phone: "" });
      toast.success(`Code ${data.referral.code} created`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggle(ref) {
    const next = !ref.active;
    setRows((prev) =>
      prev.map((r) => (r.code === ref.code ? { ...r, active: next } : r))
    );
    try {
      const res = await fetch(`/api/admin/referrals/${ref.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      toast.success(`${ref.code} ${next ? "activated" : "paused"}`);
    } catch (err) {
      setRows((prev) =>
        prev.map((r) => (r.code === ref.code ? { ...r, active: !next } : r))
      );
      toast.error(err.message || "Could not update that code.");
    }
  }

  async function remove(ref) {
    if (
      !window.confirm(
        `Delete ${ref.code}? Their ${ref.tickets} attributed ticket(s) stay on the orders, but the code stops working.`
      )
    )
      return;

    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r.code !== ref.code));
    try {
      const res = await fetch(`/api/admin/referrals/${ref.code}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      toast.success(`${ref.code} deleted`);
    } catch (err) {
      setRows(snapshot);
      toast.error(err.message || "Could not delete that code.");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black tracking-wide">Referrals</h1>

      <form onSubmit={create} className="glass rounded-2xl p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">
          New promoter code
        </p>
        <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_0.7fr_1fr_auto]">
          <input
            value={form.promoter}
            onChange={(e) => setForm({ ...form, promoter: e.target.value })}
            placeholder="Promoter name *"
            className="glass rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
          />
          <input
            value={form.code}
            onChange={(e) =>
              setForm({ ...form, code: e.target.value.toUpperCase() })
            }
            placeholder="CODE (auto)"
            className="glass rounded-xl px-3 py-2.5 font-mono text-sm uppercase text-white outline-none placeholder:font-sans placeholder:normal-case placeholder:text-white/25 focus:border-white/30"
          />
          <input
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: e.target.value })}
            placeholder="% off"
            inputMode="numeric"
            className="glass rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone"
            inputMode="tel"
            className="glass rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
          />
          <button
            type="submit"
            disabled={creating || form.promoter.trim().length < 2}
            className="bg-holo flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-black text-black transition active:scale-[0.97] disabled:opacity-40"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create
          </button>
        </div>
        <p className="mt-2 text-[10px] text-white/30">
          Leave the code blank and one is generated from the promoter&rsquo;s name.
        </p>
      </form>

      {error && (
        <p className="rounded-xl border border-[#ff2ed1]/40 bg-[#ff2ed1]/10 px-4 py-3 text-xs text-[#ff8adf]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl px-6 py-16 text-center">
          <Megaphone className="mx-auto mb-3 h-8 w-8 text-white/20" />
          <p className="font-display text-base font-bold text-white/70">
            No promoter codes yet
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-white/35">
            Create one above, copy its share link, and send it to the promoter.
            Sales get attributed automatically once a buyer uses it.
          </p>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/40">
                <th className="px-4 py-3 font-bold">#</th>
                <th className="px-4 py-3 font-bold">Code</th>
                <th className="px-4 py-3 font-bold">Promoter</th>
                <th className="px-4 py-3 text-right font-bold">Revenue</th>
                <th className="px-4 py-3 text-right font-bold">Tickets</th>
                <th className="px-4 py-3 text-right font-bold">Entries</th>
                <th className="px-4 py-3 text-right font-bold">Discount</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.code}
                  className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-3 text-xs tabular-nums text-white/30">
                    {i + 1}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tracking-wider text-white">
                    {r.code}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.promoter}</p>
                    {r.phone && (
                      <p className="text-[11px] text-white/40">{r.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-[#00f0ff]">
                    {inr(r.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.tickets}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.entries}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white/60">
                    {r.discount ? `${r.discount}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        r.active
                          ? "border-[#00f0ff]/50 text-[#00f0ff]"
                          : "border-white/20 text-white/40"
                      }`}
                    >
                      {r.active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <CopyLink code={r.code} />
                      <button
                        onClick={() => toggle(r)}
                        title={r.active ? "Pause" : "Activate"}
                        className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(r)}
                        title="Delete"
                        className="rounded-lg p-1.5 text-white/40 transition hover:bg-[#ff2ed1]/15 hover:text-[#ff8adf]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
