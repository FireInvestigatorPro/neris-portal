// app/dashboard/page.tsx
import Link from "next/link";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getBaseUrl() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

export default async function DashboardPage() {
  // If no auth cookie, force login (keeps demo DB safe)
  const cookieStore = await cookies();
  const demoToken = cookieStore.get("neris_demo_auth")?.value;
  if (!demoToken) redirect("/login");

  const base = await getBaseUrl();

  // Call our own Vercel API route (not the backend directly)
  const healthUrl = `${base}/api/health`;

  let backendBadge = "Backend: Unknown";
  let backendOk = false;

  try {
    const res = await fetch(healthUrl, {
      cache: "no-store",
      headers: {
        // IMPORTANT: forward cookie so /api/health can authenticate
        Cookie: `neris_demo_auth=${demoToken}`,
      },
    });

    if (res.ok) {
      const j = (await res.json()) as { ok?: boolean; backend?: string };
      backendOk = Boolean(j.ok);
      backendBadge = backendOk
        ? `Backend: Up`
        : `Backend: Unknown`;
      // Optional: show backend URL if you want:
      // backendBadge = backendOk ? `Backend: Up (${j.backend})` : `Backend: Unknown`;
    } else if (res.status === 401) {
      backendBadge = "Backend: Auth required";
    } else {
      backendBadge = `Backend: Down (${res.status})`;
    }
  } catch {
    backendBadge = "Backend: Down (Fetch failed)";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-slate-300 text-sm">
            Demo environment (protected). Use Departments & Incidents to verify end-to-end flow.
          </p>
        </div>

        <div
          className={[
            "rounded-full px-3 py-1 text-xs font-medium border",
            backendOk
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200",
          ].join(" ")}
        >
          {backendBadge}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm font-semibold">Quick Actions</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-medium hover:bg-orange-500"
              href="/departments"
            >
              Manage Departments
            </Link>
            <Link
              className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
              href="/incidents"
            >
              View All Incidents
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm font-semibold">Today’s Goal</div>
          <p className="mt-2 text-sm text-slate-300">
            Confirm the demo flow works end-to-end: login → pick dept → see incidents list → open incident detail.
          </p>
        </div>
      </div>
    </div>
  );
}
