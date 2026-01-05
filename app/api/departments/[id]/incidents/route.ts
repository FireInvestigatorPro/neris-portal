import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../../../_utils";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/departments/:id/incidents  -> proxies backend GET /api/v1/departments/:id/incidents/
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireDemoAuth();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/departments/${id}/incidents/`,
    { cache: "no-store" }
  );

  const text = await res.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return new NextResponse(text, { status: res.status });
  }
}

// POST /api/departments/:id/incidents -> proxies backend POST /api/v1/departments/:id/incidents/
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireDemoAuth();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json();

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/departments/${id}/incidents/`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const text = await res.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return new NextResponse(text, { status: res.status });
  }
}
