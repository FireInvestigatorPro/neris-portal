"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id: string;
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

type IncidentSummary = {
  id: string;
  title: string;
  location: string;
  date: string;
  status: string;
};

const fallbackIncidents: IncidentSummary[] = [
  {
    id: "demo-1",
    title: "Structure fire – multi-family dwelling",
    location: "Demo City, MA",
    date: "2025-01-15",
    status: "Placeholder",
  },
  {
    id: "demo-2",
    title: "Vehicle fire – parking structure",
    location: "Demo City, MA",
    date: "2025-02-03",
    status: "Placeholder",
  },
];

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Unknown date";
  // backend returns things like 2025-12-15T15:58:59Z
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 10);
}

function incidentToSummary(it: ApiIncident): IncidentSummary {
  const date = formatDate(it.occurred_at);
  const locationParts = [it.city, it.state].filter(Boolean);
  const location = locationParts.length ? locationParts.join(", ") : "Unknown location";

  // A “title” that feels good for demo purposes without having incident_type yet
  const title =
    it.neris_incident_id
      ? `Incident ${it.neris_incident_id}`
      : `Incident #${it.id}`;

  return {
    id: String(it.id),
    title,
    location,
    date,
    status: "Active",
  };
}

export default function IncidentsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);

  const [incidents, setIncidents] = useState<IncidentSummary[]>(fallbackIncidents);
  const [error, setError] = useState<string | null>(null);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);

  const selectedDepartment = useMemo(() => {
    if (!selectedDepartmentId) return null;
    return departments.find((d) => d.id === selectedDepartmentId) ?? null;
  }, [departments, selectedDepartmentId]);

  // 1) Load departments
  useEffect(() => {
    if (!baseUrl) {
      setError("API base URL is not configured; showing demo incidents.");
      return;
    }

    setLoadingDepartments(true);
    setError(null);

    fetch(`${baseUrl}/api/v1/departments/`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Departments fetch failed: ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : data;

        if (!Array.isArray(items)) {
          throw new Error("Unexpected departments response shape.");
        }

        const parsed: Department[] = items.map((d: any) => ({
          id: Number(d.id),
          name: String(d.name ?? "Unknown Department"),
          city: String(d.city ?? ""),
          state: String(d.state ?? ""),
          neris_department_id: String(d.neris_department_id ?? ""),
        }));

        setDepartments(parsed);

        // auto-select first dept if none selected yet
        if (parsed.length > 0 && selectedDepartmentId === null) {
          setSelectedDepartmentId(parsed[0].id);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load departments from API; showing demo incidents.");
        setDepartments([]);
        setSelectedDepartmentId(null);
      })
      .finally(() => setLoadingDepartments(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  // 2) Load incidents for selected department
  useEffect(() => {
    if (!baseUrl) return;
    if (!selectedDepartmentId) return;

    setLoadingIncidents(true);
    setError(null);

    fetch(`${baseUrl}/api/v1/departments/${selectedDepartmentId}/incidents/`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Incidents fetch failed: ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : data;

        if (!Array.isArray(items)) {
          throw new Error("Unexpected incidents response shape.");
        }

        if (items.length === 0) {
          setIncidents([]);
          return;
        }

        const summaries = items.map((it: any) => incidentToSummary(it as ApiIncident));
        setIncidents(summaries);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load incidents from API; showing demo incidents.");
        setIncidents(fallbackIncidents);
      })
      .finally(() => setLoadingIncidents(false));
  }, [baseUrl, selectedDepartmentId]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Incidents</h1>
          <p className="text-xs text-slate-300">
            This page pulls <span className="text-slate-100">department-scoped</span> incidents from the backend.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300" htmlFor="dept">
            Department
          </label>
          <select
            id="dept"
            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            value={selectedDepartmentId ?? ""}
            onChange={(e) => setSelectedDepartmentId(Number(e.target.value))}
            disabled={loadingDepartments || departments.length === 0}
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

      {!baseUrl && (
        <p className="text-xs text-red-400">
          NEXT_PUBLIC_API_BASE_URL is not set. You’re seeing demo incidents.
        </p>
      )}

      {selectedDepartment && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-200">
          <div className="font-semibold text-slate-100">{selectedDepartment.name}</div>
          <div className="text-[11px] text-slate-400">
            {selectedDepartment.city}, {selectedDepartment.state} · NERIS ID:{" "}
            <span className="text-slate-200">{selectedDepartment.neris_department_id}</span>
          </div>
        </div>
      )}

      {loadingDepartments && (
        <p className="text-xs text-slate-400">Loading departments…</p>
      )}

      {loadingIncidents && (
        <p className="text-xs text-slate-400">Loading incidents…</p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="space-y-2">
        {incidents.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300">
            No incidents found for this department yet.
          </div>
        ) : (
          incidents.map((incident) => {
            const href =
              selectedDepartmentId != null
                ? `/incidents/${incident.id}?departmentId=${selectedDepartmentId}`
                : `/incidents/${incident.id}`;

            return (
              <Link
                key={incident.id}
                href={href}
                className="block rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs hover:border-orange-400"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-100">{incident.title}</div>
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                    {incident.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {incident.location} · {incident.date}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
