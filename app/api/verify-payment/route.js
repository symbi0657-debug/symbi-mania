import { NextResponse } from "next/server";
import crypto from "crypto";
import { saveTicketServer, getTicketByOrderId } from "@/lib/db";
import { generateQRBuffer, generateQRDataUrl } from "@/lib/qr";
import { sendTicketEmail } from "@/lib/mailer";
import { PASS_TIERS } from "@/lib/event-config";

function generatePassId() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `FM3-${time}-${rand}`;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      pass,
      qty,
      name,
      email,
      phone,
      partnerName,
      partnerPhone,
      college,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }

    // The HMAC check is the only real proof the payment succeeded.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    const existing = await getTicketByOrderId(razorpay_order_id);
    if (existing) return NextResponse.json({ ticket: existing });

    const tier = PASS_TIERS.find((t) => t.id === pass);
    const quantity = Math.max(1, Math.min(10, Number(qty) || 1));
    const total = tier.price * quantity;

    const id = generatePassId();
    const qrDataBuffer = await generateQRBuffer(id);
    const qrDataUrl = await generateQRDataUrl(id);

    const ticket = {
      id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      passId: tier.id,
      passName: tier.name,
      quantity,
      total,
      name,
      email,
      phone,
      partnerName: partnerName || undefined,
      partnerPhone: partnerPhone || undefined,
      college: college || undefined,
      status: "paid",
      qrDataUrl,
      createdAt: new Date().toISOString(),
    };

    await saveTicketServer(ticket);

    try {
      await sendTicketEmail({ to: email, ticket, qrDataBuffer });
    } catch (mailErr) {
      console.error("Email send failed:", mailErr);
    }

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error("verify-payment error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
