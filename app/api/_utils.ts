import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "neris_demo_auth";

export async function requireDemoAuth(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const expected = process.env.DEMO_ACCESS_TOKEN;

  if (!token || !expected || token !== expected) {
    return { ok: false as const };
  }

  return { ok: true as const, token };
}
