"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id: string;
  created_at: string;
  updated_at: string;
};

type IncidentApi = {
  id: number;
  department_id: number;
  occurred_at: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  neris_incident_id: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_API_BASE = "https://infernointelai-backend.onrender.com";

/**
 * Uses NEXT_PUBLIC_API_BASE_URL if set in Vercel, otherwise falls back to Render URL.
 */
function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatLocation(i: IncidentApi) {
  const address = i.address?.trim();
  const city = i.city?.trim();
  const state = i.state?.trim();

  const parts = [address, city, state].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export default function IncidentsPage() {
  const apiBase = useMemo(() => getApiBase(), []);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  const [incidents, setIncidents] = useState<IncidentApi[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Load departments on page load
  useEffect(() => {
    setLoadingDepts(true);
    fetch(`${apiBase}/api/v1/departments/`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Failed to load departments (${res.status}). ${text}`);
        }
        return res.json();
      })
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : data;
        if (!Array.isArray(items)) throw new Error("Departments API returned an unexpected shape.");

        setDepartments(items);
        setError(null);

        // Auto-select the first department if none selected
        if (items.length > 0) {
          setSelectedDeptId((prev) => prev ?? items[0].id);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Could not load departments from API.");
        setDepartments([]);
        setSelectedDeptId(null);
      })
      .finally(() => setLoadingDepts(false));
  }, [apiBase]);

  // 2) Load incidents whenever the selected department changes
  useEffect(() => {
    if (!selectedDeptId) {
      setIncidents([]);
      return;
    }

    setLoadingIncidents(true);
    fetch(`${apiBase}/api/v1/departments/${selectedDeptId}/incidents/`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Failed to load incidents (${res.status}). ${text}`);
        }
        return res.json();
      })
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : data;
        if (!Array.isArray(items)) throw new Error("Incidents API returned an unexpected shape.");

        setIncidents(items);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Could not load incidents from API.");
        setIncidents([]);
      })
      .finally(() => setLoadingIncidents(false));
  }, [apiBase, selectedDeptId]);

  const selectedDept = departments.find((d) => d.id === selectedDeptId) ?? null;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Incidents</h1>
          <p className="text-xs text-slate-300">
            Incidents are scoped to a department in the backend API.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            API: <span className="text-slate-300">{apiBase}</span>
          </p>
        </div>

        <Link
          href="/"
          className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:border-orange-400"
        >
          ← Back
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-200">
          <div className="font-semibold">Couldn’t load data</div>
          <div className="mt-2 whitespace-pre-wrap text-[11px] text-red-100/90">{error}</div>
          <div className="mt-3 text-[11px] text-slate-200/80">
            Quick checks in <span className="text-slate-100">{apiBase}/docs</span>:
            <ul className="mt-1 list-disc pl-5">
              <li>
                GET <span className="text-slate-100">/api/v1/departments/</span>
              </li>
              <li>
                GET{" "}
                <span className="text-slate-100">
                  /api/v1/departments/{"{department_id}"}/incidents/
                </span>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-300">
            <div className="font-semibold text-slate-100">Department</div>
            <div className="text-[11px] text-slate-400">
              Select a department to view its incidents.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
              value={selectedDeptId ?? ""}
              onChange={(e) => setSelectedDeptId(Number(e.target.value))}
              disabled={loadingDepts || departments.length === 0}
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

            <Link
              href="/departments"
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 hover:border-orange-400"
            >
              Manage Departments
            </Link>
          </div>
        </div>

        {selectedDept ? (
          <div className="mt-3 text-[11px] text-slate-400">
            Selected: <span className="text-slate-200">{selectedDept.name}</span> · NERIS Dept ID:{" "}
            <span className="text-slate-200">{selectedDept.neris_department_id}</span> · Internal ID:{" "}
            <span className="text-slate-200">{selectedDept.id}</span>
          </div>
        ) : null}
      </div>

      {loadingDepts ? <p className="text-xs text-slate-400">Loading departments…</p> : null}
      {loadingIncidents ? <p className="text-xs text-slate-400">Loading incidents…</p> : null}

      <div className="space-y-2">
        {selectedDeptId && incidents.length === 0 && !loadingIncidents ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
            No incidents found for this department yet. Add one in{" "}
            <span className="text-slate-100">/docs</span> under:
            <div className="mt-1 text-[11px] text-slate-400">
              POST /api/v1/departments/{selectedDeptId}/incidents/
            </div>
          </div>
        ) : null}

        {incidents.map((i) => (
          <Link
            key={i.id}
            href={`/incidents/${i.id}`}
            className="block rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs hover:border-orange-400"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-100">
                {i.neris_incident_id ? `Incident ${i.neris_incident_id}` : `Incident #${i.id}`}
              </div>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                Dept #{i.department_id}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {formatLocation(i)} · {formatDate(i.occurred_at)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
