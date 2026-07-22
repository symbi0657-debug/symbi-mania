import QRCode from "qrcode";
import { signTicketId } from "./ids";

/**
 * The QR encodes the pass URL plus an HMAC of the pass ID. The signature means
 * a scanned code proves the ID came from us — without it, anyone who worked out
 * the `FM3-XXXX-XXXX` shape could hand-craft a link that renders like a pass.
 *
 * The QR is a convenience, not the authority: admission is decided by the
 * server-side check-in call, which is what enforces one-entry-per-pass.
 */
export function ticketUrl(ticketId) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${base}/ticket/${ticketId}?t=${signTicketId(ticketId)}`;
}

const QR_OPTS = {
  width: 400,
  margin: 2,
  errorCorrectionLevel: "M",
  color: { dark: "#0a0014", light: "#ffffff" },
};

export async function generateQRBuffer(ticketId) {
  return QRCode.toBuffer(ticketUrl(ticketId), QR_OPTS);
}

export async function generateQRDataUrl(ticketId) {
  return QRCode.toDataURL(ticketUrl(ticketId), QR_OPTS);
}
