import { NextResponse } from "next/server";
import { requireSession, ROLES } from "@/lib/auth";
import { getTicketById, updateTicket, audit } from "@/lib/db";
import { generateQRBuffer, generateQRDataUrl } from "@/lib/qr";
import { sendTicketEmail } from "@/lib/mailer";
import { TICKET_STATUS } from "@/lib/event-config";

export const dynamic = "force-dynamic";

/** Re-send the confirmation for an already-paid ticket. */
export async function POST(req, { params }) {
  try {
    const session = await requireSession(req, ROLES.ADMIN);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    let ticket = await getTicketById(id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (ticket.status !== TICKET_STATUS.PAID) {
      return NextResponse.json(
        { error: "Only approved tickets have a pass to send." },
        { status: 400 }
      );
    }

    const to = String(new URL(req.url).searchParams.get("to") || ticket.email || "").trim();
    if (!to) {
      return NextResponse.json(
        { error: "This ticket has no email address on file." },
        { status: 400 }
      );
    }

    const qrBuffer = await generateQRBuffer(id);
    if (!ticket.qrDataUrl) {
      const qrDataUrl = await generateQRDataUrl(id);
      ticket = (await updateTicket(id, { qrDataUrl })) || ticket;
    }

    try {
      await sendTicketEmail({ to, ticket, qrDataBuffer: qrBuffer });
    } catch (mailErr) {
      console.error("resend: email send failed for", id, mailErr);
      await updateTicket(id, {
        emailSent: false,
        emailError: String(mailErr?.message || mailErr),
      });
      return NextResponse.json(
        { error: "The email could not be sent. Check the SMTP settings." },
        { status: 502 }
      );
    }

    ticket =
      (await updateTicket(id, {
        emailSent: true,
        emailError: null,
        emailSentAt: new Date().toISOString(),
      })) || ticket;

    await audit("ticket_email_resent", { id, by: session.role, to });

    return NextResponse.json({ ok: true, ticket });
  } catch (err) {
    console.error("admin/tickets/[id]/resend error:", err);
    return NextResponse.json(
      { error: "Could not resend the email." },
      { status: 500 }
    );
  }
}
