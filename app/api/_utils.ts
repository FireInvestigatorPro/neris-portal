import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "neris_demo_auth";

export function backendBaseUrl(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://infernointelai-backend.onrender.com";

  return raw.replace(/\/+$/, "");
}

/**
 * Use inside API route handlers to block unauthenticated access.
 * Returns an object you can early-return from.
 */
export async function requireDemoAuth(_req?: NextRequest): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const expected = process.env.DEMO_ACCESS_TOKEN;

  // If you forgot to set it on Vercel, fail closed.
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { detail: "Server not configured (missing DEMO_ACCESS_TOKEN)." },
        { status: 500 }
      ),
    };
  }

  // Next.js 16: cookies() is async
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token || token !== expected) {
    return {
      ok: false,
      response: NextResponse.json({ detail: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true };
}
