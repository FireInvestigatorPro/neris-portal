import { NextRequest } from "next/server";

const COOKIE_NAME = "neris_demo_auth";

export function backendBaseUrl() {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL;
  if (!url) {
    throw new Error(
      "Missing BACKEND URL. Set NEXT_PUBLIC_BACKEND_URL (recommended) or BACKEND_URL in Vercel env vars."
    );
  }
  return url.replace(/\/$/, "");
}

export async function requireDemoAuth(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const expected = process.env.DEMO_ACCESS_TOKEN;

  if (!token || !expected || token !== expected) {
    return { ok: false as const };
  }

  return { ok: true as const, token };
}
