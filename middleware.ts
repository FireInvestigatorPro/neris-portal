import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/departments", "/incidents", "/dashboard"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login and public pages
  if (pathname.startsWith("/login") || pathname === "/" || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = process.env.DEMO_ACCESS_TOKEN ?? "";
  const cookie = req.cookies.get("neris_demo_auth")?.value ?? "";

  if (!token || cookie !== token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|favicon.ico).*)"],
};
