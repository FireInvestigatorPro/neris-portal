// app/api/incidents/[id]/route.ts
import { NextResponse } from "next/server";
import { requireDemoAuth } from "@/app/lib/auth.server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

function backendUrl(path: string) {
  if (!BACKEND) throw new Error("BACKEND_API_BASE_URL is not set");
  return `${BACKEND.replace(/\/$/, "")}${path}`;
}

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const auth = requireDemoAuth();
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const res = await fetch(backendUrl(`/api/v1/incidents/${ctx.params.id}`), { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
