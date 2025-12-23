import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../../../_utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  const auth = await requireDemoAuth();
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { departmentId } = await params;

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/departments/${departmentId}/incidents/`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  const auth = await requireDemoAuth();
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { departmentId } = await params;
  const body = await req.json();

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/departments/${departmentId}/incidents/`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
