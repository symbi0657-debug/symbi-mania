import nodemailer from "nodemailer";
import { generateTicketPDF } from "./ticket-pdf";
export function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function sendTicketEmail({ to, ticket, qrDataBuffer }) {
  const transporter = getTransporter();
  const ticketUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/ticket/${ticket.id}`;

  const html = `
    <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 480px; margin:0 auto; background:#0a0014; color:#fff; padding:32px; border-radius:20px;">
      <p style="text-transform:uppercase; letter-spacing:2px; font-size:11px; color:rgba(255,255,255,0.5);">Black Fox Entertainment Ent.</p>
      <h1 style="font-size:22px; background:linear-gradient(100deg,#00f0ff,#9b5cff,#ff2ed1); -webkit-background-clip:text; background-clip:text; color:#ff2ed1; margin:6px 0 16px;">SYMBI FRESHO Mania 3.0</h1>
      <p>Hi ${ticket.name},</p>
      <p>Your ${ticket.passName} is confirmed. See you on the floor.</p>
      <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:20px; margin:20px 0;">
        <p><strong>Pass ID:</strong> ${ticket.id}</p>
        <p><strong>Pass:</strong> ${ticket.passName} × ${ticket.quantity}</p>
        <p><strong>Total Paid:</strong> ₹${ticket.total}</p>
        <p><strong>Date:</strong> 8 August 2026, 6:00 PM onwards</p>
      </div>
      <div style="text-align:center; margin:24px 0;">
        <img src="cid:qrcode" alt="Pass QR Code" style="width:200px; height:200px; background:#fff; padding:12px; border-radius:12px;" />
      </div>
      <p style="text-align:center;"><a href="${ticketUrl}" style="color:#00f0ff;">View your pass online</a></p>
      <p style="font-size:11px; color:rgba(255,255,255,0.4); margin-top:24px;">Show this QR at the gate for entry. Passes are non-transferable.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Your SYMBI FRESHO Mania 3.0 Pass 🔥",
    html,
    attachments: [
      { filename: "pass-qr.png", content: qrDataBuffer, cid: "qrcode" },
      {
        filename: `${ticket.id}-ticket.pdf`,
        content: await generateTicketPDF(ticket, qrDataBuffer),
      },
    ],
  });
}
