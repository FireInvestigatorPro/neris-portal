// app/api/departments/[id]/incidents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../../../_utils";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDemoAuth();
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const url = `${backendBaseUrl()}/api/v1/departments/${encodeURIComponent(id)}/incidents/`;

  const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDemoAuth();
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const payload = await req.json();

  const url = `${backendBaseUrl()}/api/v1/departments/${encodeURIComponent(id)}/incidents/`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
