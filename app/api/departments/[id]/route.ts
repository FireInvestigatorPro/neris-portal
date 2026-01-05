import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../../_utils";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDemoAuth(req);
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const res = await fetch(`${backendBaseUrl()}/api/v1/departments/${id}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDemoAuth();
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const res = await fetch(`${backendBaseUrl()}/api/v1/departments/${id}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  // Backend might return empty body on delete
  const text = await res.text().catch(() => "");
  return new NextResponse(text || JSON.stringify({ ok: res.ok }), {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
