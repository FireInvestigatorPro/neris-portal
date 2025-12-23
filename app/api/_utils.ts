import { cookies } from "next/headers";

export function requireDemoAuth() {
  const token = cookies().get("neris_demo_auth")?.value ?? "";
  const expected = process.env.DEMO_ACCESS_TOKEN ?? "";
  if (!expected || token !== expected) {
    return { ok: false as const };
  }
  return { ok: true as const, token };
}

export function backendBaseUrl() {
  // Use one of these in Vercel env vars:
  // BACKEND_URL = https://infernointelai-backend.onrender.com
  // (or reuse NEXT_PUBLIC_BACKEND_URL if you already have it)
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://infernointelai-backend.onrender.com"
  ).replace(/\/$/, "");
}
