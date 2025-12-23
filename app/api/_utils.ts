import { cookies } from "next/headers";

export async function requireDemoAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("neris_demo_auth")?.value ?? "";
  const expected = process.env.DEMO_ACCESS_TOKEN ?? "";

  if (!expected || token !== expected) {
    return { ok: false as const };
  }
  return { ok: true as const, token };
}

export function backendBaseUrl() {
  // Set in Vercel env:
  // BACKEND_URL = https://infernointelai-backend.onrender.com
  // (or NEXT_PUBLIC_BACKEND_URL if you already use it)
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://infernointelai-backend.onrender.com"
  ).replace(/\/$/, "");
}
