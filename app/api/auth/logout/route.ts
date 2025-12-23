import { NextResponse } from "next/server";

export async function POST() {
  const cookieName = "neris_demo_auth";

  const res = NextResponse.json({ ok: true });

  res.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}
