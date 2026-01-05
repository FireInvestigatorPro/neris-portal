"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id: string;
};

type Incident = {
  id: number;
  occurred_at: string;
  address: string;
  city: string;
  state: string;
  neris_incident_id: string;
  department_id: number;
  created_at?: string;
  updated_at?: string;
};

export default function IncidentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const selectedDept = useMemo(
    () => departments.find((d) => d.id === departmentId) ?? null,
    [departments, departmentId]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDepartments() {
      try {
        const r = await fetch("/api/departments", { cache: "no-store" });
        if (!r.ok) throw new Error(`Failed to load departments (${r.status})`);
        const data = (await r.json()) as Department[];

        if (cancelled) return;
        setDepartments(data);

        // default to first dept if none selected
        if (data.length && departmentId === null) {
          setDepartmentId(data[0].id);
        }
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load departments");
      }
    }

    loadDepartments();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadIncidents() {
      if (!departmentId) return;
      setLoading(true);
      setErr(null);

      try {
        const r = await fetch(`/api/incidents?departmentId=${departmentId}`, {
          cache: "no-store",
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Failed to load incidents (${r.status}). ${text}`);
        }

        const data = (await r.json()) as Incident[];
        if (cancelled) return;
        setIncidents(data);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load incidents");
        setIncidents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadIncidents();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-sm text-slate-300">
            View incidents for a selected department.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-300">Department</label>
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            value={departmentId ?? ""}
            onChange={(e) => setDepartmentId(Number(e.target.value))}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.city}, {d.state})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedDept && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm text-slate-300">Selected</div>
          <div className="font-semibold">{selectedDept.name}</div>
          <div className="text-sm text-slate-300">
            NERIS ID: {selectedDept.neris_department_id}
          </div>
        </div>
      )}

      {err && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-4">
          <div className="font-semibold">Couldn’t load incidents</div>
          <div className="text-sm text-red-200 whitespace-pre-wrap">{err}</div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/30">
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">
          Incident List
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-slate-300">Loading…</div>
          ) : incidents.length === 0 ? (
            <div className="text-sm text-slate-300">No incidents found.</div>
          ) : (
            <div className="space-y-3">
              {incidents.map((i) => (
                <div
                  key={i.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">
                        {i.address}, {i.city}, {i.state}
                      </div>
                      <div className="text-sm text-slate-300">
                        Occurred: {new Date(i.occurred_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400">
                        NERIS Incident ID: {i.neris_incident_id}
                      </div>
                    </div>

                    <Link
                      className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold hover:bg-orange-500"
                      href={`/incidents/${i.id}`}
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
