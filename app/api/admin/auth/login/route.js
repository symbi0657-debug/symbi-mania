import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSession,
  roleForPassword,
  sessionCookieOptions,
} from "@/lib/auth";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { audit } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The single brute-force surface in the app. Limited hard by IP: five attempts
 * per fifteen minutes. The failure message is deliberately identical whether the
 * password was wrong, empty, or a near-miss on the gate password — revealing
 * "that's the gate password, not the admin one" would hand an attacker a free
 * oracle for enumerating which of the two secrets they had guessed.
 */
export async function POST(req) {
  try {
    const ip = clientIp(req);

    const rl = await rateLimit({
      bucket: "adminlogin",
      key: ip,
      limit: 5,
      windowSeconds: 900,
    });
    if (!rl.ok) return tooMany(rl.retryAfter);

    const body = await req.json().catch(() => ({}));
    const password = String(body?.password ?? "");

    const role = roleForPassword(password);
    if (!role) {
      await audit("admin_login_failed", { ip });
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const token = await createSession(role);
    const res = NextResponse.json({ role });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);

    await audit("admin_login", { role, ip });
    return res;
  } catch (err) {
    console.error("admin/auth/login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
