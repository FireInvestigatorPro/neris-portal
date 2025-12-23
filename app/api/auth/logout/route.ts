import { NextResponse } from "next/server";

export async function POST() {
  // Must match the cookie name used in your login route
  const cookieName = "neris_demo_auth";

  const res = NextResponse.json({ ok: true });

  // Clear cookie (works on most setups)
  res.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}

// Optional: allow GET so you can hit it in browser
export async function GET() {
  return POST();
}
