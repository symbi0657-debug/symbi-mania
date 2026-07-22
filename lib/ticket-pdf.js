import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * pdf-lib's StandardFonts are WinAnsi-encoded and THROW on any character
 * outside that set — Devanagari, emoji, curly quotes pasted from a phone
 * keyboard, even the ₹ sign. This runs inside the approval path, so an
 * unencodable buyer name would take down the confirmation email for a payment
 * that has already been accepted. Strip to a safe subset instead.
 */
function safeText(value, fallback = "") {
<<<<<<< HEAD
  const s = String(value ?? "").replace(/[^\x20-\x7E]/g, "").trim();
=======
<<<<<<< HEAD
  const s = String(value ?? "").replace(/[^\x20-\x7E]/g, "").trim();
=======
  const s = String(value ?? "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
>>>>>>> ca7f066851bbb3ddf5a079ac0fd3ae2b5589d67e
>>>>>>> 4249f22f8fafa34c8b1ddc488ddae4bb8270f874
  return s || fallback;
}

export async function generateTicketPDF(ticket, qrPngBuffer) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 620]);

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 400,
    height: 620,
    color: rgb(0.04, 0.02, 0.09),
  });

  // Header
  page.drawText("BLACK FOX ENTERTAINMENT ENT.", {
    x: 30,
    y: 570,
    size: 8,
    font: regular,
    color: rgb(0.7, 0.7, 0.75),
  });
<<<<<<< HEAD
  page.drawText("FRESHO", {
=======
<<<<<<< HEAD
  page.drawText("FRESHO", {
=======
  page.drawText("SYMBI FRESHO", {
>>>>>>> ca7f066851bbb3ddf5a079ac0fd3ae2b5589d67e
>>>>>>> 4249f22f8fafa34c8b1ddc488ddae4bb8270f874
    x: 30,
    y: 540,
    size: 26,
    font: bold,
    color: rgb(0.95, 0.2, 0.75),
  });
  page.drawText("Mania 3.0", {
    x: 30,
    y: 510,
    size: 22,
    font: bold,
    color: rgb(0.6, 0.4, 0.95),
  });

  // Attendee details
  page.drawText("ATTENDEE", {
    x: 30,
    y: 460,
    size: 8,
    font: regular,
    color: rgb(0.6, 0.6, 0.65),
  });
  page.drawText(safeText(ticket.name, "Guest").slice(0, 26), {
    x: 30,
    y: 440,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawText("PASS", {
    x: 220,
    y: 460,
    size: 8,
    font: regular,
    color: rgb(0.6, 0.6, 0.65),
  });
  page.drawText(safeText(`${ticket.passName} x ${ticket.quantity}`), {
    x: 220,
    y: 440,
    size: 12,
    font: bold,
    color: rgb(0.95, 0.4, 0.85),
  });

  page.drawText("DATE", {
    x: 30,
    y: 400,
    size: 8,
    font: regular,
    color: rgb(0.6, 0.6, 0.65),
  });
  page.drawText("8 August 2026", {
    x: 30,
    y: 380,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawText("DOORS", {
    x: 220,
    y: 400,
    size: 8,
    font: regular,
    color: rgb(0.6, 0.6, 0.65),
  });
  page.drawText("6:00 PM", {
    x: 220,
    y: 380,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Divider
  page.drawLine({
    start: { x: 30, y: 350 },
    end: { x: 370, y: 350 },
    thickness: 1,
    color: rgb(0.3, 0.3, 0.35),
    dashArray: [4, 4],
  });

  // QR code
  const qrImage = await pdfDoc.embedPng(qrPngBuffer);
  page.drawRectangle({
    x: 30,
    y: 190,
    width: 140,
    height: 140,
    color: rgb(1, 1, 1),
  });
  page.drawImage(qrImage, { x: 40, y: 200, width: 120, height: 120 });

  // Pass ID + status
  page.drawText("PASS ID", {
    x: 190,
    y: 300,
    size: 8,
    font: regular,
    color: rgb(0.6, 0.6, 0.65),
  });
  page.drawText(safeText(ticket.id), {
    x: 190,
    y: 280,
    size: 14,
    font: bold,
    color: rgb(0.5, 0.8, 1),
  });

  page.drawText(`ADMITS ${ticket.entries || ticket.quantity}`, {
    x: 190,
    y: 262,
    size: 9,
    font: regular,
    color: rgb(0.8, 0.8, 0.85),
  });

  page.drawText("STATUS", {
    x: 190,
    y: 250,
    size: 8,
    font: regular,
    color: rgb(0.6, 0.6, 0.65),
  });
  page.drawText("CONFIRMED", {
    x: 190,
    y: 232,
    size: 10,
    font: bold,
    color: rgb(0.3, 0.9, 1),
  });

  // Footer
  page.drawText("Show this QR at the gate for entry.", {
    x: 30,
    y: 60,
    size: 9,
    font: regular,
    color: rgb(0.6, 0.6, 0.65),
  });
  page.drawText("Passes are non-transferable.", {
    x: 30,
    y: 45,
    size: 9,
    font: regular,
    color: rgb(0.6, 0.6, 0.65),
  });

  return Buffer.from(await pdfDoc.save());
}
