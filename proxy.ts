import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, hashPassword } from "./lib/auth";

export const config = {
  matcher: ["/((?!api/cron|api/login|login|_next/static|_next/image|favicon.ico).*)"],
};

export async function proxy(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const expected = await hashPassword(process.env.APP_PASSWORD || "");

  if (cookie && expected && cookie === expected) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
