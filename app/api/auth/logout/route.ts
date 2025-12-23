import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

function requireBackendUrl() {
  if (!BACKEND_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL env var");
  }
  return BACKEND_URL.replace(/\/+$/, "");
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ departmentId: string }> }
) {
  try {
    const { departmentId } = await context.params;

    const base = requireBackendUrl();
    const url = `${base}/api/v1/departments/${encodeURIComponent(
      departmentId
    )}/incidents/`;

    const resp = await fetch(url, { cache: "no-store" });
    const text = await resp.text();

    return new NextResponse(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message ?? "Failed to proxy incidents" },
      { status: 500 }
    );
  }
}
