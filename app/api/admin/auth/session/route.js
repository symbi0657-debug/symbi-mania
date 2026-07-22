import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Any valid session passes — the client uses the role to pick its nav. */
export async function GET(req) {
  try {
    const session = await requireSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ role: session.role });
  } catch (err) {
    console.error("admin/auth/session error:", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
