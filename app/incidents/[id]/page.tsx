"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Department = {
  id: number;
  name: string;
  city?: string | null;
  state?: string | null;
  neris_department_id?: string | null;
};

type ApiIncident = {
  id: number;
  department_id: number;
  occurred_at: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  neris_incident_id: string | null;
  created_at?: string;
  updated_at?: string;
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  // Keep it simple & consistent for demo (UTC-ish)
  return d.toISOString().replace("T", " ").replace("Z", " UTC");
}

function joinLocation(inc: ApiIncident) {
  return [inc.address, inc.city, inc.state].filter(Boolean).join(", ") || "—";
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getApiBase() {
  const fallback = "https://infernointelai-backend.onrender.com";
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? fallback;
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const incidentIdStr = params?.id;
  const incidentId = Number(incidentIdStr);

  const departmentIdParam = searchParams?.get("departmentId");
  const departmentId = departmentIdParam ? Number(departmentIdParam) : null;

  const apiBase = getApiBase();

  const [incident, setIncident] = useState<ApiIncident | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValidIncidentId = useMemo(
    () => Number.isFinite(incidentId) && incidentId > 0,
    [incidentId]
  );

  const isValidDepartmentId = useMemo(
    () => departmentId !== null && Number.isFinite(departmentId) && departmentId > 0,
    [departmentId]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setStatusMsg(null);
      setIncident(null);
      setDepartment(null);

      if (!isValidIncidentId) {
        setError(`Invalid incident id: "${incidentIdStr}"`);
        setLoading(false);
        return;
      }

      // ------------------------------------------------------------
      // 1) BEST PATH FOR YOUR CURRENT BACKEND:
      //    If we have departmentId, fetch that department’s incidents and find the match.
      // ------------------------------------------------------------
      if (isValidDepartmentId && departmentId) {
        try {
          setStatusMsg("Loading incident from department…");

          const deptRes = await fetch(`${apiBase}/api/v1/departments/${departmentId}`, {
            cache: "no-store",
          });
          if (deptRes.ok) {
            const d = (await safeJson(deptRes)) as any;
            if (!cancelled && d) {
              setDepartment({
                id: Number(d.id),
                name: String(d.name ?? "Unknown Department"),
                city: d.city ?? null,
                state: d.state ?? null,
                neris_department_id: d.neris_department_id ?? null,
              });
            }
          }

          const incRes = await fetch(
            `${apiBase}/api/v1/departments/${departmentId}/incidents/`,
            { cache: "no-store" }
          );

          if (!incRes.ok) {
            const text = await incRes.text().catch(() => "");
            throw new Error(`Failed to load incidents (${incRes.status}). ${text}`);
          }

          const incJson = await safeJson(incRes);
          const items = Array.isArray((incJson as any)?.items) ? (incJson as any).items : incJson;

          if (!Array.isArray(items)) {
            throw new Error("Unexpected incidents response shape.");
          }

          const match = items.find((x: any) => Number(x?.id) === incidentId) as ApiIncident | undefined;

          if (!match) {
            throw new Error("Incident not found in that department.");
          }

          if (!cancelled) {
            setIncident(match);
            setLoading(false);
            setStatusMsg(null);
          }
          return;
        } catch (e: any) {
          if (!cancelled) {
            setError(e?.message ?? "Failed to load incident from department.");
            setLoading(false);
            setStatusMsg(null);
          }
          return;
        }
      }

      // ------------------------------------------------------------
      // 2) Optional fast path: if backend supports GET /api/v1/incidents/{id}
      // ------------------------------------------------------------
      try {
        setStatusMsg("Loading incident…");

        const res = await fetch(`${apiBase}/api/v1/incidents/${incidentId}`, {
          cache: "no-store",
        });

        if (res.ok) {
          const data = (await safeJson(res)) as ApiIncident | null;
          if (!cancelled && data) {
            setIncident(data);

            // Try to also load the department name for nicer display
            const deptRes = await fetch(`${apiBase}/api/v1/departments/${data.department_id}`, {
              cache: "no-store",
            });
            if (deptRes.ok) {
              const d = (await safeJson(deptRes)) as any;
              if (!cancelled && d) {
                setDepartment({
                  id: Number(d.id),
                  name: String(d.name ?? "Unknown Department"),
                  city: d.city ?? null,
                  state: d.state ?? null,
                  neris_department_id: d.neris_department_id ?? null,
                });
              }
            }

            setLoading(false);
            setStatusMsg(null);
            return;
          }
        }
      } catch {
        // swallow and try scan fallback
      }

      // ------------------------------------------------------------
      // 3) Demo-scale fallback: scan departments and search incidents for the ID
      // ------------------------------------------------------------
      try {
        setStatusMsg("Searching incident across departments…");

        const deptRes = await fetch(`${apiBase}/api/v1/departments/`, { cache: "no-store" });
        if (!deptRes.ok) throw new Error(`Departments fetch failed: ${deptRes.status}`);

        const deptJson = await safeJson(deptRes);
        const deptItems = Array.isArray((deptJson as any)?.items) ? (deptJson as any).items : deptJson;

        if (!Array.isArray(deptItems)) throw new Error("Unexpected departments response shape.");

        const departments: Department[] = deptItems.map((d: any) => ({
          id: Number(d.id),
          name: String(d.name ?? "Unknown Department"),
          city: d.city ?? null,
          state: d.state ?? null,
          neris_department_id: d.neris_department_id ?? null,
        }));

        for (const d of departments) {
          if (cancelled) return;

          setStatusMsg(`Checking ${d.name}…`);

          const incRes = await fetch(`${apiBase}/api/v1/departments/${d.id}/incidents/`, {
            cache: "no-store",
          });

          if (!incRes.ok) continue;

          const incJson = await safeJson(incRes);
          const incItems = Array.isArray((incJson as any)?.items) ? (incJson as any).items : incJson;

          if (!Array.isArray(incItems)) continue;

          const match = incItems.find((x: any) => Number(x?.id) === incidentId) as ApiIncident | undefined;

          if (match) {
            if (!cancelled) {
              setIncident(match);
              setDepartment(d);
            }
            break;
          }
        }

        if (!cancelled) {
          if (!incident) {
            setError("Incident not found. It may have been deleted, or not accessible.");
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load incident.");
      } finally {
        if (!cancelled) {
          setStatusMsg(null);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentIdStr]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Incident Detail</h1>
          <p className="text-xs text-slate-300">
            Incident ID: <span className="text-slate-100">{incidentIdStr}</span>
            {isValidDepartmentId && departmentId ? (
              <>
                {" "}
                · Dept ID: <span className="text-slate-100">{departmentId}</span>
              </>
            ) : null}
          </p>
        </div>

        <Link
          href="/incidents"
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
        >
          ← Back to Incidents
        </Link>
      </div>

      <div className="text-[11px] text-slate-500">
        Backend: <span className="text-slate-300">{apiBase}</span>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-300">{statusMsg ?? "Loading…"}</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
          <p className="text-xs text-red-300 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {!loading && incident && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-200">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-slate-100">
              {incident.neris_incident_id
                ? `NERIS Incident: ${incident.neris_incident_id}`
                : `Incident #${incident.id}`}
            </div>

            <div className="text-[11px] text-slate-400">
              Occurred: <span className="text-slate-200">{formatDateTime(incident.occurred_at)}</span>
            </div>

            <div className="text-[11px] text-slate-400">
              Location: <span className="text-slate-200">{joinLocation(incident)}</span>
            </div>

            <div className="text-[11px] text-slate-400">
              Department:{" "}
              <span className="text-slate-200">
                {department ? `${department.name} (ID ${department.id})` : `ID ${incident.department_id}`}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Created</div>
                <div className="text-xs text-slate-200">{formatDateTime(incident.created_at)}</div>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Updated</div>
                <div className="text-xs text-slate-200">{formatDateTime(incident.updated_at)}</div>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Next demo step</div>
              <div className="mt-1 text-[11px] text-slate-300">
                Add “notes / tags / attachments” panels here next — that’s what will make chiefs and insurers feel the value fast.
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
