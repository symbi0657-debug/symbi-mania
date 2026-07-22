import { NextResponse } from "next/server";
import { requireSession, ROLES } from "@/lib/auth";
import { getTicketById } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Full record including PII — this is the admin view, that is the point. */
export async function GET(req, { params }) {
  try {
    const session = await requireSession(req, ROLES.ADMIN);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await getTicketById(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error("admin/tickets/[id] error:", err);
    return NextResponse.json(
      { error: "Could not load ticket." },
      { status: 500 }
    );
  }
}
