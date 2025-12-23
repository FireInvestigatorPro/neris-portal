import { NextRequest, NextResponse } from "next/server";

function getBackendBaseUrl() {
  const url =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!url) return null;
  return url.replace(/\/$/, "");
}

// GET /api/departments/[departmentId]/incidents
export async function GET(req: NextRequest, context: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await context.params;

  const base = getBackendBaseUrl();
  if (!base) {
    return NextResponse.json(
      { detail: "Backend URL not configured. Set BACKEND_URL in Vercel env." },
      { status: 500 }
    );
  }

  const upstreamUrl = `${base}/api/v1/departments/${encodeURIComponent(
    departmentId
  )}/incidents/`;

  const upstreamRes = await fetch(upstreamUrl, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  const bodyText = await upstreamRes.text();

  return new NextResponse(bodyText, {
    status: upstreamRes.status,
    headers: {
      "content-type":
        upstreamRes.headers.get("content-type") ?? "application/json",
    },
  });
}

// POST /api/departments/[departmentId]/incidents
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ departmentId: string }> }
) {
  const { departmentId } = await context.params;

  const base = getBackendBaseUrl();
  if (!base) {
    return NextResponse.json(
      { detail: "Backend URL not configured. Set BACKEND_URL in Vercel env." },
      { status: 500 }
    );
  }

  const upstreamUrl = `${base}/api/v1/departments/${encodeURIComponent(
    departmentId
  )}/incidents/`;

  const json = await req.json();

  const upstreamRes = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(json),
  });

  const bodyText = await upstreamRes.text();

  return new NextResponse(bodyText, {
    status: upstreamRes.status,
    headers: {
      "content-type":
        upstreamRes.headers.get("content-type") ?? "application/json",
    },
  });
}
