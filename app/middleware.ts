import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)"],
};

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Neris Portal"',
    },
  });
}

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  // If env vars aren't set, fail closed (site stays locked)
  if (!user || !pass) return unauthorized();

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized();

  const base64 = auth.replace("Basic ", "");
  let decoded = "";
  try {
    decoded = atob(base64);
  } catch {
    return unauthorized();
  }

  const [u, p] = decoded.split(":");
  if (u !== user || p !== pass) return unauthorized();

  return NextResponse.next();
}
