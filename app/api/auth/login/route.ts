// app/api/auth/login/route.ts
import { NextResponse } from "next/server";

const COOKIE_NAME = "neris_demo_auth"; // must match what your requireDemoAuth checks

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "").trim();

  const expectedEmail = (process.env.DEMO_LOGIN_EMAIL ?? "").trim();
  const expectedPassword = (process.env.DEMO_LOGIN_PASSWORD ?? "").trim();

  // Optional “token-style” demo password (single shared secret)
  const accessToken = (process.env.DEMO_ACCESS_TOKEN ?? "").trim();

  const okEmailPass =
    !!expectedEmail &&
    !!expectedPassword &&
    email.toLowerCase() === expectedEmail.toLowerCase() &&
    password === expectedPassword;

  const okToken = !!accessToken && password === accessToken;

  if (!okEmailPass && !okToken) {
    return NextResponse.json({ detail: "Invalid credentials." }, { status: 401 });
  }

  // Store the access token (or password) as the cookie value so downstream checks can compare
  const cookieValue = accessToken || expectedPassword || password;

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}
