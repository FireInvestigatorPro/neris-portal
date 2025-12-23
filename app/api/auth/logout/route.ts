// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "neris_demo_auth";

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  // Clear the auth cookie
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}

// Optional: allow GET so you can click it in a browser
export async function GET(req: NextRequest) {
  return POST(req);
}