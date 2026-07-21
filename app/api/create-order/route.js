/*import { NextResponse } from "next/server";
import { getRazorpayInstance } from "@/lib/razorpay";
import { PASS_TIERS } from "@/lib/event-config";

export async function POST(req) {
  try {
    const body = await req.json();
    const { pass, qty, name, email, phone } = body;

    const tier = PASS_TIERS.find((t) => t.id === pass);
    if (!tier) return NextResponse.json({ error: "Invalid pass type" }, { status: 400 });

    const quantity = Math.max(1, Math.min(10, Number(qty) || 1));

    if (!name || name.trim().length < 2)
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    if (!/^[6-9]\d{9}$/.test(String(phone).replace(/\D/g, "").slice(-10)))
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

    const total = tier.price * quantity;

    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: total * 100,
      currency: "INR",
      receipt: `fm3_${Date.now()}`,
      notes: { pass, quantity: String(quantity), name, email, phone },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      total,
    });
  } catch (err) {
    console.error("create-order error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
*/

import { NextResponse } from "next/server";
import { Cashfree } from "@/lib/cashfree";

export async function POST(req) {
  const { amount, name, email, phone } = await req.json();

  const orderId = `order_${Date.now()}`;

  const request = {
    order_amount: amount,
    order_currency: "INR",
    order_id: orderId,
    customer_details: {
      customer_id: phone,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
    },
    order_meta: {
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout?order_id={order_id}`,
    },
  };

  try {
    const response = await Cashfree.PGCreateOrder("2023-08-01", request);
    return NextResponse.json({
      orderId,
      paymentSessionId: response.data.payment_session_id,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
