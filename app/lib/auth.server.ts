// app/lib/auth.server.ts
import { cookies } from "next/headers";

export async function requireDemoAuth() {
  const cookieName = "neris_demo_auth"; // must match login route cookie name
  const cookieStore = await cookies();   // ✅ Next.js 16: cookies() is async now
  const cookie = cookieStore.get(cookieName)?.value;

  const expected = process.env.DEMO_ACCESS_TOKEN; // server-only secret
  if (!expected || !cookie || cookie !== expected) {
    return { ok: false as const };
  }

  return { ok: true as const, token: cookie };
}
