import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../../_utils";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireDemoAuth();
  if (!auth.ok) {
    return NextResponse.json({ detail: "Auth required" }, { status: 401 });
  }

  const { id } = await context.params;

  const departmentId = req.nextUrl.searchParams.get("departmentId");
  if (!departmentId) {
    return NextResponse.json(
      { detail: "Missing departmentId query param" },
      { status: 400 }
    );
  }

  const url = `${backendBaseUrl()}/api/v1/departments/${encodeURIComponent(
    departmentId
  )}/incidents/${encodeURIComponent(id)}`;

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireDemoAuth();
  if (!auth.ok) {
    return NextResponse.json({ detail: "Auth required" }, { status: 401 });
  }

  const { id } = await context.params;

  const departmentId = req.nextUrl.searchParams.get("departmentId");
  if (!departmentId) {
    return NextResponse.json(
      { detail: "Missing departmentId query param" },
      { status: 400 }
    );
  }

  const url = `${backendBaseUrl()}/api/v1/departments/${encodeURIComponent(
    departmentId
  )}/incidents/${encodeURIComponent(id)}`;

  const res = await fetch(url, { method: "DELETE", cache: "no-store" });
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}