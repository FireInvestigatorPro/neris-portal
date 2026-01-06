// app/api/_utils.ts
import { cookies } from "next/headers";

/**
 * Where the FastAPI backend lives.
 * Set BACKEND_URL in Vercel envs to override.
 */
export function backendBaseUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://infernointelai-backend.onrender.com"
  ).replace(/\/+$/, "");
}

/**
 * Demo auth check for Vercel API routes.
 * Requires:
 * - cookie: neris_demo_auth
 * - env: DEMO_ACCESS_TOKEN
 */
export async function requireDemoAuth() {
  const cookieName = "neris_demo_auth";
  const store = await cookies();
  const token = store.get(cookieName)?.value;

  const expected = process.env.DEMO_ACCESS_TOKEN;

  if (!expected || !token || token !== expected) {
    return { ok: false as const };
  }

  return { ok: true as const, token };
}
