import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL;

function baseUrl() {
  if (!BACKEND_URL) throw new Error("Missing BACKEND_URL env var");
  return BACKEND_URL.replace(/\/$/, "");
}

// GET /api/departments/[id]
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const r = await fetch(`${baseUrl()}/api/v1/departments/${id}`, {
      cache: "no-store",
    });

    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { detail: e?.message || "Failed to fetch department" },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id]
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const r = await fetch(`${baseUrl()}/api/v1/departments/${id}`, {
      method: "DELETE",
    });

    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { detail: e?.message || "Failed to delete department" },
      { status: 500 }
    );
  }
}
