import Link from "next/link";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id?: string | null;
};

type ApiIncident = {
  id: number;
  department_id: number;
  occurred_at: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  neris_incident_id?: string | null;
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

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 10);
}

function incidentTitle(it: ApiIncident) {
  return it.neris_incident_id ? `Incident ${it.neris_incident_id}` : `Incident #${it.id}`;
}

function incidentLocation(it: ApiIncident) {
  const parts = [it.city, it.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
}

export default async function DepartmentIncidentsPage({
  params,
}: {
  params: { id: string };
}) {
  const backend = pickBackendBaseUrl();
  const departmentId = Number(params.id);

  const deptResp = await fetchJson<Department[]>(`${backend}/api/v1/departments/`);
  const departments = deptResp.ok ? deptResp.data : [];

  const selectedDepartment =
    Number.isFinite(departmentId)
      ? departments.find((d) => d.id === departmentId) ?? null
      : null;

  let incidents: ApiIncident[] = [];
  let incidentsError: string | null = null;

  if (Number.isFinite(departmentId)) {
    const incResp = await fetchJson<ApiIncident[]>(
      `${backend}/api/v1/departments/${departmentId}/incidents/`
    );
    if (incResp.ok) incidents = incResp.data;
    else incidentsError = incResp.status ? `Failed (${incResp.status})` : "Fetch failed";
  } else {
    incidentsError = "Invalid department id in route params.";
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Incidents</h1>
          <p className="text-xs text-slate-300">
            Department-scoped incidents (server-fetched to avoid browser CORS fallbacks).
          </p>
        </div>

        {/* Department switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300" htmlFor="dept">
            Department
          </label>
          <select
            id="dept"
            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            value={Number.isFinite(departmentId) ? departmentId : ""}
            onChange={(e) => {
              const next = e.target.value;
              if (next) window.location.href = `/departments/${next}/incidents`;
            }}
            disabled={departments.length === 0}
          >
            {departments.length === 0 ? (
              <option value="">No departments</option>
            ) : (
              departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.city}, {d.state})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {selectedDepartment ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-200">
          <div className="font-semibold text-slate-100">{selectedDepartment.name}</div>
          <div className="text-[11px] text-slate-400">
            {selectedDepartment.city}, {selectedDepartment.state} · NERIS ID:{" "}
            <span className="text-slate-200">{selectedDepartment.neris_department_id ?? "—"}</span>
          </div>
        </div>
      ) : null}

      {!deptResp.ok ? (
        <p className="text-xs text-red-400">
          Could not load departments from backend. Backend:{" "}
          <span className="text-slate-200">{backend}</span>
        </p>
      ) : null}

      {incidentsError ? (
        <p className="text-xs text-red-400">
          Could not load incidents from backend: {incidentsError}
        </p>
      ) : null}

      <div className="space-y-2">
        {incidents.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300">
            No incidents found for this department yet.
          </div>
        ) : (
          incidents.map((it) => (
            <Link
              key={it.id}
              href={`/incidents/${it.id}?departmentId=${departmentId}`}
              className="block rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs hover:border-orange-400"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-100">{incidentTitle(it)}</div>
                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                  Active
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {incidentLocation(it)} · {formatDate(it.occurred_at)}
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
