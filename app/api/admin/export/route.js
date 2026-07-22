import { requireSession, ROLES } from "@/lib/auth";
import { listAllTickets, audit } from "@/lib/db";

export const dynamic = "force-dynamic";

const COLUMNS = [
  ["Pass ID", "id"],
  ["Order Ref", "orderRef"],
  ["Status", "status"],
  ["Name", "name"],
  ["Email", "email"],
  ["Phone", "phone"],
  ["College", "college"],
  ["Pass", "passName"],
  ["Pass ID (tier)", "passId"],
  ["Quantity", "quantity"],
  ["Entries", "entries"],
  ["Subtotal", "subtotal"],
  ["Discount", "discount"],
  ["Amount", "total"],
  ["Referral", "referralCode"],
  ["UTR", "utr"],
  ["Partner Name", "partnerName"],
  ["Partner Phone", "partnerPhone"],
  ["Verified By", "verifiedBy"],
  ["Verified At", "verifiedAt"],
  ["Rejection Reason", "rejectionReason"],
  ["Checked In At", "checkedInAt"],
  ["Checked In By", "checkedInBy"],
  ["Email Sent", "emailSent"],
  ["Created At", "createdAt"],
  ["Expires At", "expiresAt"],
  ["Updated At", "updatedAt"],
];

/**
 * Every field is quoted unconditionally and internal quotes are doubled, per
 * RFC 4180. Names contain commas ("Rao, Aditya"), rejection reasons contain
 * quotes and newlines, and a single unescaped one silently shifts every later
 * column in that row — which is exactly the kind of corruption nobody notices
 * until they're reconciling money.
 */
function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let s = String(value);

  // Formula injection: Excel and Sheets evaluate any cell starting with = + -
  // or @, even inside quotes. `name` and `college` are buyer-controlled, so a
  // buyer could register as `=HYPERLINK("http://evil","Click")` — or something
  // that quietly exfiltrates the sheet — and it would execute on the organiser's
  // machine when they open the export. A leading apostrophe forces text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;

  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req) {
  try {
    const session = await requireSession(req, ROLES.ADMIN);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tickets = await listAllTickets();

    const lines = [COLUMNS.map(([label]) => csvCell(label)).join(",")];
    for (const t of tickets) {
      lines.push(COLUMNS.map(([, key]) => csvCell(t[key])).join(","));
    }

    // Leading BOM so Excel opens UTF-8 names correctly instead of mojibake.
    const csv = "﻿" + lines.join("\r\n") + "\r\n";

    const stamp = new Date().toISOString().slice(0, 10);
    await audit("tickets_exported", { by: session.role, count: tickets.length });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fresho-mania-tickets-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("admin/export error:", err);
    return new Response(JSON.stringify({ error: "Export failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
