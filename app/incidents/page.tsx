"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

export default function IncidentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);

  const selectedDept = useMemo(
    () => departments.find((d) => d.id === selectedDeptId) ?? null,
    [departments, selectedDeptId]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) Load departments (via your Next API proxy)
        const deptRes = await fetch("/api/departments", { cache: "no-store" });
        if (!deptRes.ok) {
          const t = await deptRes.text();
          throw new Error(`Failed to load departments (${deptRes.status}). ${t}`);
        }
        const deptData: Department[] = await deptRes.json();
        if (cancelled) return;

        setDepartments(deptData);

        // Select first department if none selected yet
        const initialId = deptData[0]?.id ?? null;
        setSelectedDeptId((prev) => prev ?? initialId);

        // If there are no depts, there can’t be incidents
        if (!initialId) {
          setIncidents([]);
          setLoading(false);
          return;
        }

        // 2) Load incidents for selected department
        const incRes = await fetch(`/api/departments/${initialId}/incidents`, { cache: "no-store" });
        if (!incRes.ok) {
          const t = await incRes.text();
          throw new Error(`Failed to load incidents (${incRes.status}). ${t}`);
        }
        const incData: Incident[] = await incRes.json();
        if (cancelled) return;

        setIncidents(incData);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Unknown error");
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // When user changes department, reload incidents for that dept
  async function onSelectDept(id: number) {
    setSelectedDeptId(id);
    setLoading(true);
    setError(null);

    try {
      const incRes = await fetch(`/api/departments/${id}/incidents`, { cache: "no-store" });
      if (!incRes.ok) {
        const t = await incRes.text();
        throw new Error(`Failed to load incidents (${incRes.status}). ${t}`);
      }
      const incData: Incident[] = await incRes.json();
      setIncidents(incData);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      setIncidents([]);
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Incidents</h1>
        <Link href="/departments" style={{ textDecoration: "underline" }}>
          Manage departments
        </Link>
      </div>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 600 }}>Department:</div>

          {departments.length === 0 ? (
            <div>No departments found. Create one first.</div>
          ) : (
            <select
              value={selectedDeptId ?? ""}
              onChange={(e) => onSelectDept(Number(e.target.value))}
              style={{ padding: 8, borderRadius: 8 }}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.city}, {d.state} (#{d.id})
                </option>
              ))}
            </select>
          )}

          {selectedDept?.neris_department_id ? (
            <div style={{ opacity: 0.8 }}>
              NERIS Dept ID: <code>{selectedDept.neris_department_id}</code>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #f2b8b5" }}>
          <div style={{ fontWeight: 700 }}>Couldn’t load incidents</div>
          <div style={{ marginTop: 6, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div>Loading…</div>
        ) : incidents.length === 0 ? (
          <div style={{ opacity: 0.85 }}>
            No incidents for this department yet. Add one in your backend docs, then refresh this page.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {incidents.map((i) => (
              <div key={i.id} style={{ padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>
                    Incident #{i.id}{" "}
                    {i.neris_incident_id ? <span style={{ opacity: 0.8 }}>({i.neris_incident_id})</span> : null}
                  </div>
                  <div style={{ opacity: 0.75 }}>
                    {i.occurred_at ? new Date(i.occurred_at).toLocaleString() : "No time"}
                  </div>
                </div>

                <div style={{ marginTop: 8, opacity: 0.9 }}>
                  {[i.address, i.city, i.state].filter(Boolean).join(", ") || "No address"}
                </div>

                <div style={{ marginTop: 10 }}>
                  <Link href={`/incidents/${i.id}`} style={{ textDecoration: "underline" }}>
                    View detail
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
