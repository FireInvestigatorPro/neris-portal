import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  const okEmail = (process.env.DEMO_LOGIN_EMAIL ?? "").trim().toLowerCase();
  const okPass = process.env.DEMO_LOGIN_PASSWORD ?? "";
  const token = process.env.DEMO_ACCESS_TOKEN ?? "";

  if (!okEmail || !okPass || !token) {
    return NextResponse.json(
      { detail: "Server auth is not configured (missing env vars)." },
      { status: 500 }
    );
  }

  if (email !== okEmail || password !== okPass) {
    return NextResponse.json({ detail: "Invalid credentials." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  // HttpOnly cookie so it can't be set via JS console
  res.cookies.set("neris_demo_auth", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });

  return res;
}
