import { NextResponse } from "next/server";
import { findTicketServer } from "@/lib/db";

export async function POST(req) {
  const { query } = await req.json();
  if (!query || !query.trim()) {
    return NextResponse.json({ error: "Enter a phone, email, or Pass ID" }, { status: 400 });
  }
  const ticket = await findTicketServer(query);
  if (!ticket) return NextResponse.json({ error: "No pass found" }, { status: 404 });
  return NextResponse.json({ ticket });
}
