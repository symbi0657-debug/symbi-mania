import { NextResponse } from "next/server";
import { requireSession, ROLES } from "@/lib/auth";
import { checkInTicket, getTicketById, audit } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * At a dark door with a queue behind them, a gate volunteer will hand us a Pass
 * ID in every shape it can take: scanned straight off the QR (which encodes a
 * full signed ticket URL), typed in lowercase, or typed without the dashes
 * because the keyboard hid them. Normalise all of it to the canonical
 * FM3-XXXX-XXXX before we go anywhere near Redis — a "not found" caused by a
 * missing hyphen looks identical to a forged pass, and the volunteer has about
 * two seconds to tell them apart.
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

/** Only what the gate screen needs — no need to spray PII across the door. */
function publicTicket(t) {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    passId: t.passId,
    passName: t.passName,
    quantity: t.quantity,
    entries: t.entries,
    status: t.status,
    checkedInAt: t.checkedInAt || null,
    checkedInBy: t.checkedInBy || null,
  };
}

/** Allowed for gate staff as well as admins. */
export async function POST(req) {
  try {
    const session = await requireSession(req, ROLES.GATE);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.code || "");
    const id = normalizePassId(raw);

    if (!id) {
      return NextResponse.json({
        result: "not_found",
        message: "That is not a valid Pass ID.",
        code: raw.slice(0, 64),
      });
    }

    const result = await checkInTicket(id, { by: session.role });

    if (result.ok) {
      await audit("checkin_ok", { id, by: session.role });
      return NextResponse.json({
        result: "ok",
        message: "ADMITTED",
        ticket: publicTicket(result.ticket),
      });
    }

    if (result.reason === "already_used") {
      await audit("checkin_duplicate", { id, by: session.role });
      return NextResponse.json({
        result: "already_used",
        message: "ALREADY USED",
        checkedInAt: result.ticket.checkedInAt,
        checkedInBy: result.ticket.checkedInBy,
        ticket: publicTicket(result.ticket),
      });
    }

    if (result.reason === "not_paid") {
      await audit("checkin_unpaid", { id, by: session.role, status: result.ticket.status });
      return NextResponse.json({
        result: "not_paid",
        message: "NOT PAID",
        status: result.ticket.status,
        ticket: publicTicket(result.ticket),
      });
    }

    // not_found — confirm against the raw store so the message is honest about
    // whether the ID exists at all.
    const exists = await getTicketById(id);
    return NextResponse.json({
      result: "not_found",
      message: "NOT FOUND",
      code: id,
      ticket: publicTicket(exists),
    });
  } catch (err) {
    console.error("admin/checkin error:", err);
    // "Try again" is the wrong instruction when the database is unreachable —
    // the volunteer will retry forever with a queue building behind them. Tell
    // them it's us, not the pass, so they can fall back to admitting on the
    // paper list and reconciling later.
    const unreachable = /Upstash|fetch failed|ECONN|ETIMEDOUT|network/i.test(
      err?.message || ""
    );
    return NextResponse.json(
      {
        error: unreachable
          ? "Can't reach the ticket database. This is a system fault, not a bad pass — check the network and use the backup list if it persists."
          : "Check-in failed. Try again.",
        systemFault: unreachable,
      },
      { status: 503 }
    );
  }
}
