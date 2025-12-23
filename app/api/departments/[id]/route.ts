import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../../_utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDemoAuth();
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const res = await fetch(`${backendBaseUrl()}/api/v1/departments/${id}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
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
