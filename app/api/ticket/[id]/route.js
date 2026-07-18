import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(req, { params }) {
  const db = await getDB();
  const ticket = db.data.tickets.find((t) => t.id === params.id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const { phone, email, partnerPhone, ...safe } = ticket;
  return NextResponse.json({ ticket: safe });
}
