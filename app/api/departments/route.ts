import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL;

function requireBackendUrl() {
  if (!BACKEND_URL) {
    throw new Error(
      "Missing BACKEND_URL. Set BACKEND_URL (or NEXT_PUBLIC_BACKEND_URL) in Vercel environment variables."
    );
  }
  return BACKEND_URL.replace(/\/$/, "");
}

export async function GET() {
  try {
    const base = requireBackendUrl();
    const r = await fetch(`${base}/api/v1/departments/`, { cache: "no-store" });
    const text = await r.text();

    return new NextResponse(text, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { detail: e?.message || "Failed to fetch departments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const base = requireBackendUrl();
    const body = await req.json();

    const r = await fetch(`${base}/api/v1/departments/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await r.text();

    return new NextResponse(text, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { detail: e?.message || "Failed to create department" },
      { status: 500 }
    );
  }
}
