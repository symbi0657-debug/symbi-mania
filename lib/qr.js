import QRCode from "qrcode";

function ticketUrl(ticketId) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${base}/ticket/${ticketId}`;
}

export async function generateQRBuffer(ticketId) {
  return QRCode.toBuffer(ticketUrl(ticketId), {
    width: 400,
    margin: 2,
    color: { dark: "#0a0014", light: "#ffffff" },
  });
}

export async function generateQRDataUrl(ticketId) {
  return QRCode.toDataURL(ticketUrl(ticketId), {
    width: 400,
    margin: 2,
    color: { dark: "#0a0014", light: "#ffffff" },
  });
}
