import { NextResponse } from "next/server";
import { getInventory, isRedisConfigured } from "@/lib/db";
import { PASS_TIERS } from "@/lib/event-config";

export const dynamic = "force-dynamic";

/**
 * Live remaining counts per tier, so "X left" on the passes page is the real
 * number rather than decoration.
 */
export async function GET() {
  try {
    if (!isRedisConfigured()) {
      // Local dev without Upstash: report full capacity rather than blank out
      // the pricing cards.
      return NextResponse.json({
        inventory: PASS_TIERS.map((t) => ({
          id: t.id,
          name: t.name,
          price: t.price,
          capacity: t.capacity,
          sold: 0,
          left: t.capacity,
        })),
      });
    }

    return NextResponse.json({ inventory: await getInventory() });
  } catch (err) {
    console.error("inventory GET error:", err);
    return NextResponse.json(
      { error: "Could not load availability." },
      { status: 500 }
    );
  }
}
