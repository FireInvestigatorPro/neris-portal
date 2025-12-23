// app/lib/auth.server.ts
import { cookies } from "next/headers";

export function requireDemoAuth() {
  const cookieName = "neris_demo_auth"; // must match your login route.ts cookie name
  const cookie = cookies().get(cookieName)?.value;

  const expected = process.env.DEMO_ACCESS_TOKEN; // server-side secret
  if (!cookie || !expected || cookie !== expected) {
    return { ok: false as const };
  }
  return { ok: true as const };
}
