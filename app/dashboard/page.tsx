import Link from "next/link";
import { headers } from "next/headers";
import { requireDemoAuth } from "../lib/auth.server";
import type { ReactNode } from "react";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Incident = {
  id: number;
  department_id: number;
  occurred_at?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  neris_incident_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

function getBackendBaseUrl(): string {
  const url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) return "";
  return url.replace(/\/+$/, "");
}

/**
 * Build the current site origin so we can call our own /api/* routes from a Server Component.
 * Works on Vercel (x-forwarded-host/proto) and locally (host).
 *
 * Next.js 16+: headers() is async.
 */
async function getSiteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch failed (${res.status}) ${url} :: ${text}`);
  }
  return (await res.json()) as T;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-700">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

export default async function DashboardPage() {
  // Next.js 16 demo auth commonly relies on async cookies() under the hood, so await is safest.
  await requireDemoAuth();

  const base = getBackendBaseUrl();
  if (!base) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="mt-4 rounded-xl border bg-white p-4">
          <div className="font-semibold text-red-600">Missing BACKEND_URL</div>
          <p className="mt-2 text-sm text-gray-700">
            Set{" "}
            <code className="rounded bg-gray-100 px-1">BACKEND_URL</code> in
            Vercel to:{" "}
            <code className="ml-1 rounded bg-gray-100 px-1">
              https://infernointelai-backend.onrender.com
            </code>
          </p>
        </div>
      </div>
    );
  }

  // IMPORTANT: Use our own proxy health endpoint (/api/health),
  // instead of calling `${base}/health` (your backend doesn't expose /health).
  const origin = await getSiteOrigin();
  const healthUrl = origin ? `${origin}/api/health` : "/api/health";

  const departmentsUrl = `${base}/api/v1/departments/`;

  let backendOk = false;
  let backendMsg = "";
  let departments: Department[] = [];
  let incidents: Incident[] = [];
  let loadError: string | null = null;

  try {
    // Health badge (via frontend API proxy)
    try {
      const health = await fetchJson<{ ok: boolean; backend?: string; detail?: any }>(
        healthUrl
      );
      backendOk = !!health.ok;
      backendMsg = backendOk ? "Online" : "Down";
    } catch (e: any) {
      backendOk = false;
      backendMsg = e?.message?.includes("Fetch failed (401)")
        ? "Auth required"
        : "Down";
    }

    // 1) Load depts
    departments = await fetchJson<Department[]>(departmentsUrl);

    // 2) Load incidents per dept (since /api/v1/incidents/ is NOT available)
    const incidentLists = await Promise.all(
      departments.map(async (d) => {
        const url = `${base}/api/v1/departments/${d.id}/incidents/`;
        try {
          return await fetchJson<Incident[]>(url);
        } catch {
          return [];
        }
      })
    );

    incidents = incidentLists.flat();
  } catch (e: any) {
    loadError = e?.message || "Failed to load dashboard data.";
  }

  const totalDepartments = departments.length;
  const totalIncidents = incidents.length;

  const last7Cutoff = new Date(daysAgoIso(7)).getTime();
  const last7Days = incidents.filter((i) => {
    const t = i.occurred_at ? new Date(i.occurred_at).getTime() : NaN;
    return Number.isFinite(t) && t >= last7Cutoff;
  }).length;

  const sortedByOccurred = [...incidents].sort((a, b) => {
    const ta = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
    const tb = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
    return tb - ta;
  });

  const latest = sortedByOccurred[0];
  const latestDept =
    latest && departments.find((d) => d.id === latest.department_id);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Quick value snapshot for the demo portal.
          </p>
        </div>

        <div className="rounded-full border px-3 py-1 text-sm">
          <span
            className={`inline-block h-2 w-2 rounded-full align-middle ${
              backendOk ? "bg-green-500" : "bg-red-500"
            }`}
          />{" "}
          <span className="ml-2 align-middle text-gray-700">
            Backend: {backendMsg}
          </span>
        </div>
      </div>

      {loadError ? (
        <div className="mt-6 rounded-xl border bg-white p-4">
          <div className="font-semibold text-red-600">Couldn’t load data</div>
          <div className="mt-2 text-sm text-gray-700">{loadError}</div>
          <div className="mt-3 text-sm text-gray-600">
            Quick check these endpoints:
            <ul className="mt-1 list-disc pl-5">
              <li>
                <code className="rounded bg-gray-100 px-1">{departmentsUrl}</code>
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">
                  {base}/api/v1/departments/{"{id}"}/incidents/
                </code>
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">{healthUrl}</code>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Departments"
              value={totalDepartments}
              hint="Active departments in the system"
            />
            <Stat
              label="Incidents"
              value={totalIncidents}
              hint="Total incidents logged"
            />
            <Stat
              label="Last 7 days"
              value={last7Days}
              hint="Recent incident activity"
            />
            <Stat
              label="Data integrity"
              value={totalDepartments > 0 ? "OK" : "Needs seed"}
              hint="Basic demo readiness check"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Latest Incident">
              {latest ? (
                <div className="text-sm text-gray-800">
                  <div className="font-semibold">
                    {latest.neris_incident_id || `Incident #${latest.id}`}
                  </div>
                  <div className="mt-1 text-gray-600">
                    Occurred: {formatDate(latest.occurred_at)}
                  </div>
                  <div className="mt-1 text-gray-600">
                    Location:{" "}
                    {[latest.address, latest.city, latest.state]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </div>
                  <div className="mt-1 text-gray-600">
                    Department:{" "}
                    {latestDept
                      ? `${latestDept.name} (${latestDept.city}, ${latestDept.state})`
                      : `ID ${latest.department_id}`}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Link
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                      href={`/incidents/${latest.id}`}
                    >
                      View incident
                    </Link>
                    <Link
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                      href={`/incidents`}
                    >
                      View all incidents
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-700">
                  No incidents yet. Add one in{" "}
                  <Link className="underline" href="/incidents">
                    Incidents
                  </Link>{" "}
                  to light up the dashboard.
                </div>
              )}
            </Card>

            <Card title="Demo Checklist">
              <ul className="list-disc pl-5 text-sm text-gray-700">
                <li>Login required ✅</li>
                <li>Departments CRUD ✅</li>
                <li>Dept incidents listing ✅</li>
                <li>Dashboard value panel ✅</li>
              </ul>
              <div className="mt-3 text-xs text-gray-500">
                Next: incident detail polish + department→incidents drilldown.
              </div>
            </Card>

            <Card title="Quick Links">
              <div className="flex flex-col gap-2 text-sm">
                <Link className="underline" href="/departments">
                  Manage Departments
                </Link>
                <Link className="underline" href="/incidents">
                  View Incidents
                </Link>
                <a
                  className="underline"
                  href={`${base}/docs`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Backend API Docs
                </a>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
