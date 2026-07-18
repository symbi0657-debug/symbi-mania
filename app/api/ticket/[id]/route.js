import { NextResponse } from "next/server";
import { getTicketById } from "@/lib/db";

export async function GET(req, { params }) {
  const ticket = await getTicketById(params.id);
  if (!ticket)
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const { phone, email, partnerPhone, ...safe } = ticket;
  return NextResponse.json({ ticket: safe });
}
