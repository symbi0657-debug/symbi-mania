import { NextResponse } from "next/server";
import { requireSession, ROLES } from "@/lib/auth";
import {
  getStats,
  getInventory,
  listAudit,
  listReferrals,
  isRedisConfigured,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const session = await requireSession(req, ROLES.ADMIN);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: "Storage is not configured." },
        { status: 503 }
      );
    }

    const [stats, inventory, activity, referrals] = await Promise.all([
      getStats(),
      getInventory(),
      listAudit(25),
      listReferrals(),
    ]);

    // Already sorted by revenue in listReferrals(). Only promoters who have
    // actually sold something reach the dashboard — a wall of zero rows during
    // setup buries the ones that matter.
    const topPromoters = referrals.filter((r) => r.tickets > 0).slice(0, 5);

    return NextResponse.json({
      stats,
      inventory,
      activity,
      topPromoters,
      promoterCount: referrals.length,
    });
  } catch (err) {
    console.error("admin/stats error:", err);
    return NextResponse.json(
      { error: "Could not load dashboard." },
      { status: 500 }
    );
  }
}
