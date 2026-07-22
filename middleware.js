import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSession, ROLES } from "@/lib/auth";

/**
 * Admin gate + security headers.
 *
 * The individual API routes verify the session again themselves. That's
 * deliberate duplication: middleware is a convenience redirect for humans, and
 * a matcher typo here shouldn't be the only thing standing between the public
 * internet and the approve-payment endpoint.
 */

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/auth/login"];

// The gate crew's password only unlocks check-in. Everything else — revenue,
// buyer PII, the ability to approve payments — stays with the admin password.
const GATE_ALLOWED = ["/admin/checkin", "/api/admin/checkin", "/api/admin/auth"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  const isAdminArea =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminArea && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);

    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }

    if (
      session.role === ROLES.GATE &&
      !GATE_ALLOWED.some((p) => pathname.startsWith(p))
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/admin/checkin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();

  // Admin pages show buyer PII and payment state — keep them out of any cache.
  if (isAdminArea) {
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return res;
}

export const config = {
  // Skip static assets so the auth check isn't paid on every image request.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|mp4|ico)$).*)"],
};
