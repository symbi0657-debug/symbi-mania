import { NextResponse } from "next/server";
import { requireSession, ROLES } from "@/lib/auth";
import {
  listTickets,
  listTicketsByStatus,
  listAllTickets,
  getTicketById,
  getTicketByOrderRef,
  findTicketsByEmail,
  findTicketsByPhone,
} from "@/lib/db";
import { TICKET_STATUS } from "@/lib/event-config";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(Object.values(TICKET_STATUS));

/**
 * Accept a Pass ID however an admin happens to have it: pasted from an email,
 * typed in lowercase, or with the dashes left out because they were reading it
 * off a phone screen.
 */
function normalizePassId(raw) {
  const s = String(raw || "").toUpperCase();
  const m = s.match(/FM3[^0-9A-Z]?([0-9A-Z]{4})[^0-9A-Z]?([0-9A-Z]{4})/);
  if (m) return `FM3-${m[1]}-${m[2]}`;
  const compact = s.replace(/[^0-9A-Z]/g, "");
  if (/^[0-9A-Z]{8}$/.test(compact)) {
    return `FM3-${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return null;
}

const byNewest = (a, b) =>
  new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

/**
 * Resolve a search term through the indexes first. Scanning every ticket to find
 * one email address is the kind of thing that's fine with fifty tickets and
 * unusable with five thousand, so the full scan is the last resort only — and
 * it's the only way to match on a buyer's name, which has no index.
 */
async function search(term) {
  const q = term.trim();

  const passId = normalizePassId(q);
  if (passId) {
    const t = await getTicketById(passId);
    if (t) return [t];
  }

  if (q.includes("@")) {
    const rows = await findTicketsByEmail(q);
    if (rows.length) return rows;
  }

  const digits = q.replace(/\D/g, "");
  if (digits.length >= 10) {
    const rows = await findTicketsByPhone(digits);
    if (rows.length) return rows;
  }

  if (/^[A-Za-z0-9]{4,12}$/.test(q)) {
    const t = await getTicketByOrderRef(q.toUpperCase());
    if (t) return [t];
  }

  const needle = q.toLowerCase();
  const all = await listAllTickets();
  return all.filter((t) =>
    [t.name, t.id, t.orderRef, t.utr, t.email, t.phone, t.college]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle))
  );
}

export async function GET(req) {
  try {
    const session = await requireSession(req, ROLES.ADMIN);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    const term = url.searchParams.get("search") || "";
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const limit = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("limit")) || 50)
    );

    if (status && !VALID_STATUS.has(status)) {
      return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    }

    let rows;
    let total = null;

    if (term.trim()) {
      rows = await search(term);
      if (status) rows = rows.filter((t) => t.status === status);
      rows.sort(byNewest);
      total = rows.length;
      rows = rows.slice(offset, offset + limit);
    } else if (status) {
      // The status index is a SET, so it comes back unordered — sort before
      // paging or "page 2" would return an arbitrary reshuffle each request.
      const all = await listTicketsByStatus(status);
      all.sort(byNewest);
      total = all.length;
      rows = all.slice(offset, offset + limit);
    } else {
      rows = await listTickets({ offset, limit });
    }

    return NextResponse.json({
      tickets: rows,
      total,
      offset,
      limit,
      hasMore: total === null ? rows.length === limit : offset + rows.length < total,
    });
  } catch (err) {
    console.error("admin/tickets error:", err);
    return NextResponse.json(
      { error: "Could not load tickets." },
      { status: 500 }
    );
  }
}
