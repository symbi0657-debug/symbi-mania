import nodemailer from "nodemailer";
import { generateTicketPDF } from "./ticket-pdf";
import { EVENT_CONFIG } from "./event-config";
import { signTicketId } from "./ids";

export function isMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

let _transporter = null;

export function getTransporter() {
  if (_transporter) return _transporter;
  const port = Number(process.env.SMTP_PORT || 465);
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Without explicit timeouts a hung SMTP connection blocks the request until
    // the platform's function timeout kills it — the admin sees an approval
    // spinner that never resolves and clicks again.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    // Connection pooling is actively harmful on serverless. Vercel freezes the
    // function between invocations, so a pooled socket is usually dead by the
    // next call — the first send then fails on a stale connection — and an open
    // pool keeps the event loop alive, delaying the response. Pool only where
    // the process is long-lived.
    pool: !process.env.VERCEL,
    maxConnections: 3,
  });
  return _transporter;
}

/**
 * Buyer-controlled values (name, college, and admin-written rejection reasons)
 * are interpolated into email HTML. Mail clients strip scripts so the practical
 * risk is low, but an unescaped `<` in a name silently mangles the layout, and
 * "it's only rendered in email" is a bad reason to ship an injection.
 */
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const shell = (inner) => `
  <div style="font-family:'Space Grotesk',Arial,sans-serif;max-width:480px;margin:0 auto;background:#0a0014;color:#fff;padding:32px;border-radius:20px;">
    <p style="text-transform:uppercase;letter-spacing:2px;font-size:11px;color:rgba(255,255,255,0.5);margin:0;">${EVENT_CONFIG.organizer}</p>
    <h1 style="font-size:22px;color:#ff2ed1;margin:6px 0 16px;">${EVENT_CONFIG.name}</h1>
    ${inner}
    <p style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:24px;">
      Questions? WhatsApp us on +${EVENT_CONFIG.whatsapp}.
    </p>
  </div>`;

const detailBox = (rows) => `
  <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:20px;margin:20px 0;">
    ${rows.map(([k, v]) => `<p style="margin:6px 0;"><strong>${k}:</strong> ${v}</p>`).join("")}
  </div>`;

/** Sent once Cashfree confirms the payment. This is the pass. */
export async function sendTicketEmail({ to, ticket, qrDataBuffer }) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  // Signed, so the link in the email opens the pass rather than 404ing — the
  // ticket API rejects an unsigned request by design.
  const ticketUrl = `${base}/ticket/${ticket.id}?t=${signTicketId(ticket.id)}`;

  const html = shell(`
    <p>Hi ${esc(ticket.name)},</p>
    <p>Payment confirmed. Your ${esc(ticket.passName)} is locked in — see you on the floor.</p>
    ${detailBox([
      ["Pass ID", esc(ticket.id)],
      ["Pass", esc(`${ticket.passName} × ${ticket.quantity}`)],
      ["Total Paid", `₹${ticket.total}`],
      ["Date", `${EVENT_CONFIG.dateLabel}, ${EVENT_CONFIG.timeLabel}`],
      ["Venue", EVENT_CONFIG.venue],
    ])}
    <div style="text-align:center;margin:24px 0;">
      <img src="cid:qrcode" alt="Pass QR code" style="width:200px;height:200px;background:#fff;padding:12px;border-radius:12px;" />
    </div>
    <p style="text-align:center;"><a href="${ticketUrl}" style="color:#00f0ff;">View your pass online</a></p>
    <p style="font-size:11px;color:rgba(255,255,255,0.4);">
      Show this QR — or quote Pass ID <strong>${esc(ticket.id)}</strong> — at the gate.
      This pass admits ${ticket.entries || ticket.quantity} and can only be used once.
      Passes are non-transferable.
    </p>
  `);

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Your ${EVENT_CONFIG.name} Pass 🔥 (${ticket.id})`,
    html,
    attachments: [
      { filename: "pass-qr.png", content: qrDataBuffer, cid: "qrcode" },
      {
        filename: `${ticket.id}-pass.pdf`,
        content: await generateTicketPDF(ticket, qrDataBuffer),
      },
    ],
  });
}
