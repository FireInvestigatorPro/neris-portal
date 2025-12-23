import { NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../../../_utils";

export async function GET(_req: Request, ctx: { params: { departmentId: string } }) {
  const auth = requireDemoAuth();
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { departmentId } = ctx.params;

  const r = await fetch(`${backendBaseUrl()}/api/v1/departments/${departmentId}/incidents/`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}

export async function POST(req: Request, ctx: { params: { departmentId: string } }) {
  const auth = requireDemoAuth();
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { departmentId } = ctx.params;
  const body = await req.text();

  const r = await fetch(`${backendBaseUrl()}/api/v1/departments/${departmentId}/incidents/`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body,
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}
