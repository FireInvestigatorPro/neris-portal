import Link from "next/link";

type Incident = {
  id: number;
  department_id: number;
  occurred_at: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  neris_incident_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id?: string | null;
};

async function fetchJson<T>(
  url: string
): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, text };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, status: 0, text: e?.message ?? "Fetch failed" };
  }
}

function pickBackendBaseUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://infernointelai-backend.onrender.com"
  );
}

function fmtWhen(iso?: string | null) {
  if (!iso) return { local: "Unknown time", utc: "Unknown time" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { local: "Unknown time", utc: "Unknown time" };
  return { local: d.toLocaleString(), utc: d.toUTCString() };
}

function buildLocation(i: Incident) {
  const parts = [i.address, i.city, i.state].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "Unknown location";
}

export default async function IncidentDetailPage({
  params,
  searchParams,
}: {
  // ✅ Next 16: params/searchParams may be Promises in server components
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const backend = pickBackendBaseUrl();

  const p = (await params) as { id: string };
  const sp = (await searchParams) ?? {};

  const rawDeptId = sp.departmentId;
  const departmentId =
    typeof rawDeptId === "string"
      ? Number(rawDeptId)
      : Array.isArray(rawDeptId)
      ? Number(rawDeptId[0])
      : NaN;

  const rawIncidentId = p?.id;
  const incidentIdNum = typeof rawIncidentId === "string" ? Number(rawIncidentId) : NaN;

  // 1) Fetch incident directly by ID (preferred)
  let incident: Incident | null = null;
  let fetchNote: string | null = null;

  if (Number.isFinite(incidentIdNum)) {
    const incResp = await fetchJson<Incident>(`${backend}/api/v1/incidents/${incidentIdNum}`);
    if (incResp.ok) {
      incident = incResp.data;
    } else {
      fetchNote = incResp.status ? `Direct incident fetch failed (${incResp.status})` : "Direct incident fetch failed";
    }
  } else {
    fetchNote = "Invalid incident id in route params.";
  }

  // 2) Fallback: if direct fetch failed and we have departmentId, load dept incidents and find it
  if (!incident && Number.isFinite(departmentId) && Number.isFinite(incidentIdNum)) {
    const deptIncResp = await fetchJson<Incident[]>(
      `${backend}/api/v1/departments/${departmentId}/incidents/`
    );

    if (deptIncResp.ok) {
      incident = deptIncResp.data.find((x) => Number(x.id) === incidentIdNum) ?? null;
      if (!incident) {
        fetchNote = `Incident ${incidentIdNum} not found in department ${departmentId}.`;
      }
    } else {
      fetchNote = deptIncResp.status
        ? `Department incident list fetch failed (${deptIncResp.status})`
        : "Department incident list fetch failed";
    }
  }

  // Optional: department label (best effort)
  let department: Department | null = null;
  if (incident?.department_id) {
    const deptResp = await fetchJson<Department>(`${backend}/api/v1/departments/${incident.department_id}`);
    if (deptResp.ok) department = deptResp.data;
  }

  if (!incident) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-slate-400">Incident Case File</div>
        <h1 className="text-2xl font-semibold">Incident not available</h1>
        <p className="text-sm text-slate-300">We couldn’t load this incident from the backend.</p>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
          <div className="font-semibold text-slate-100">Debug note</div>
          <div className="mt-1">{fetchNote ?? "Unknown error"}</div>

          <div className="mt-3 text-slate-400">
            Backend: <span className="text-slate-200">{backend}</span>
          </div>

          <div className="mt-2 text-slate-400">
            Raw params.id: <span className="text-slate-200">{String(rawIncidentId)}</span>
          </div>

          <div className="mt-1 text-slate-400">
            URL should include departmentId when coming from a department list, e.g.{" "}
            <span className="text-slate-200">?departmentId=7</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/dashboard" className="text-sm text-orange-400 hover:underline">
            ← Back to Dashboard
          </Link>
          <Link href="/incidents" className="text-sm text-orange-400 hover:underline">
            View All Incidents →
          </Link>
        </div>
      </div>
    );
  }

  const when = fmtWhen(incident.occurred_at);
  const location = buildLocation(incident);
  const title = incident.neris_incident_id ? `Incident ${incident.neris_incident_id}` : `Incident #${incident.id}`;
  const deptLabel = department?.name ?? (incident.department_id ? `Department #${incident.department_id}` : "Department");

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <div className="text-xs text-slate-400">Incident Case File</div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="text-sm text-slate-300">{location}</div>
      </section>

      <section className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <StatusPill status={"Under Investigation"} />
        <div className="text-sm">
          <span className="text-slate-400">Occurred:</span> {when.local}
          <div className="text-xs text-slate-500">UTC: {when.utc}</div>
        </div>

        {incident.department_id ? (
          <Link href={`/departments/${incident.department_id}`} className="text-sm text-orange-400 hover:underline">
            {deptLabel}
          </Link>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-sm font-semibold text-orange-400">Investigation Notes</h3>
        <p className="mt-2 text-sm text-slate-300">
          Notes entered here are structured to support NFPA 921 methodology, separating observations, analysis, and hypotheses.
        </p>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-sm font-semibold text-orange-400">Tags</h3>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-sm font-semibold text-orange-400">Evidence & Attachments</h3>
        <p className="mt-2 text-sm text-slate-400">Photos, reports, and supporting documentation (Phase 2)</p>
      </section>

      <section className="flex justify-end">
        <button disabled className="rounded bg-slate-700 px-4 py-2 text-sm text-slate-300 cursor-not-allowed">
          Export Case File (PDF)
        </button>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "Completed" ? "bg-green-600" : status === "Under Investigation" ? "bg-yellow-500" : "bg-slate-600";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold text-black ${color}`}>
      {status}
    </span>
  );
}
