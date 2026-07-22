import { NextResponse } from "next/server";
import { requireSession, ROLES } from "@/lib/auth";
import { getReferral, updateReferral, deleteReferral, audit } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const session = await requireSession(req, ROLES.ADMIN);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const code = String(params.code || "").toUpperCase();
    const body = await req.json().catch(() => ({}));

    // Whitelisted: a patch that could set `code` or `createdAt` would let a
    // typo orphan the record from its ref:index entry and its counters.
    const patch = {};
    if ("active" in body) patch.active = Boolean(body.active);
    if ("discount" in body) {
      patch.discount = Math.max(0, Math.min(100, Number(body.discount) || 0));
    }
    if ("promoter" in body) patch.promoter = String(body.promoter).trim();
    if ("phone" in body) patch.phone = String(body.phone).trim();
    if ("note" in body) patch.note = String(body.note).trim().slice(0, 300);

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const existing = await getReferral(code);
    if (!existing) {
      return NextResponse.json({ error: "Code not found" }, { status: 404 });
    }

    const referral = await updateReferral(code, patch);
    await audit("referral_updated", { code, patch, by: session.role });

    return NextResponse.json({ ok: true, referral });
  } catch (err) {
    console.error("admin/referrals/[code] PATCH error:", err);
    return NextResponse.json(
      { error: "Could not update that code." },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await requireSession(req, ROLES.ADMIN);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const code = String(params.code || "").toUpperCase();
    const existing = await getReferral(code);
    if (!existing) {
      return NextResponse.json({ error: "Code not found" }, { status: 404 });
    }

    await deleteReferral(code);
    await audit("referral_deleted", { code, by: session.role });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/referrals/[code] DELETE error:", err);
    return NextResponse.json(
      { error: "Could not delete that code." },
      { status: 500 }
    );
  }
}
