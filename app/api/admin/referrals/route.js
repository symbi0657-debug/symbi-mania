import { NextResponse } from "next/server";
import { requireSession, ROLES } from "@/lib/auth";
import { listReferrals, createReferral, audit } from "@/lib/db";
import { generateReferralCode } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const session = await requireSession(req, ROLES.ADMIN);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ referrals: await listReferrals() });
  } catch (err) {
    console.error("admin/referrals GET error:", err);
    return NextResponse.json(
      { error: "Could not load referral codes." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await requireSession(req, ROLES.ADMIN);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const promoter = String(body?.promoter || "").trim();
    if (promoter.length < 2) {
      return NextResponse.json(
        { error: "Enter the promoter's name." },
        { status: 400 }
      );
    }

    // Blank code → derive one from their name, so the promoter gets something
    // they can actually say out loud instead of eight random characters.
    const code = String(body?.code || "").trim().toUpperCase() ||
      generateReferralCode(promoter);

    if (!/^[A-Z0-9]{3,16}$/.test(code)) {
      return NextResponse.json(
        { error: "Codes must be 3–16 letters or numbers, no spaces." },
        { status: 400 }
      );
    }

    const discount = Math.max(0, Math.min(100, Number(body?.discount) || 0));

    const result = await createReferral({
      code,
      promoter,
      phone: String(body?.phone || "").trim(),
      discount,
      note: String(body?.note || "").trim().slice(0, 300),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: `The code ${code} is already taken.` },
        { status: 409 }
      );
    }

    await audit("referral_created", { code, promoter, by: session.role });

    return NextResponse.json({
      ok: true,
      referral: { ...result.referral, tickets: 0, entries: 0, revenue: 0 },
    });
  } catch (err) {
    console.error("admin/referrals POST error:", err);
    return NextResponse.json(
      { error: "Could not create that code." },
      { status: 500 }
    );
  }
}
