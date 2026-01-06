import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../../_utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireDemoAuth();
  if (!auth.ok) {
    return NextResponse.json({ detail: "Auth required" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const res = await fetch(`${backendBaseUrl()}/api/v1/departments/${id}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireDemoAuth();
  if (!auth.ok) {
    return NextResponse.json({ detail: "Auth required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.text();

  const res = await fetch(`${backendBaseUrl()}/api/v1/departments/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      Accept: "application/json",
    },
    body,
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireDemoAuth();
  if (!auth.ok) {
    return NextResponse.json({ detail: "Auth required" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const res = await fetch(`${backendBaseUrl()}/api/v1/departments/${id}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
