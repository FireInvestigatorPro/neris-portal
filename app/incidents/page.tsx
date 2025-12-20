"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function IncidentsPage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "https://infernointelai-backend.onrender.com";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Load departments
  useEffect(() => {
    let cancelled = false;

    async function loadDepartments() {
      setLoadingDepartments(true);
      setError(null);

      try {
        const res = await fetch(`${baseUrl}/api/v1/departments/`, { cache: "no-store" });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to load departments (${res.status}). ${text}`);
        }

        const data: Department[] = await res.json();

        if (cancelled) return;
        setDepartments(data);

        // Default selection: first department (if any)
        if (data.length > 0) {
          setSelectedDepartmentId((prev) => (prev ?? data[0].id));
        } else {
          setSelectedDepartmentId(null);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Couldn’t load departments.");
      } finally {
        if (!cancelled) setLoadingDepartments(false);
      }
    }

    loadDepartments();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const selectedDepartment = useMemo(() => {
    if (!selectedDepartmentId) return null;
    return departments.find((d) => d.id === selectedDepartmentId) ?? null;
  }, [departments, selectedDepartmentId]);

  // 2) Load incidents for selected department
  useEffect(() => {
    let cancelled = false;

    async function loadIncidentsForDepartment(departmentId: number) {
      setLoadingIncidents(true);
      setError(null);

      try {
        const res = await fetch(
          `${baseUrl}/api/v1/departments/${departmentId}/incidents/`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to load incidents (${res.status}). ${text}`);
        }

        const data: Incident[] = await res.json();
        if (cancelled) return;

        setIncidents(data);
      } catch (e: any) {
        if (cancelled) return;
        setIncidents([]);
        setError(e?.message ?? "Couldn’t load incidents.");
      } finally {
        if (!cancelled) setLoadingIncidents(false);
      }
    }

    if (selectedDepartmentId) {
      loadIncidentsForDepartment(selectedDepartmentId);
    } else {
      setIncidents([]);
    }

    return () => {
      cancelled = true;
    };
  }, [baseUrl, selectedDepartmentId]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Incidents</h1>
      <p style={{ marginBottom: 16, opacity: 0.85 }}>
        Incidents are currently loaded **per department** (matches your backend routes).
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <label style={{ fontWeight: 600 }}>Department:</label>

        {loadingDepartments ? (
          <span>Loading departments…</span>
        ) : departments.length === 0 ? (
          <span>No departments yet. Create one first in the Departments page.</span>
        ) : (
          <select
            value={selectedDepartmentId ?? ""}
            onChange={(e) => setSelectedDepartmentId(Number(e.target.value))}
            style={{ padding: 8, minWidth: 320 }}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.city}, {d.state} (id: {d.id})
              </option>
            ))}
          </select>
        )}

        {selectedDepartment ? (
          <Link
            href={`/departments`}
            style={{ marginLeft: "auto", textDecoration: "underline" }}
          >
            Manage Departments →
          </Link>
        ) : null}
      </div>

      {error ? (
        <div
          style={{
            padding: 12,
            border: "1px solid #f0b4b4",
            background: "#fff5f5",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <strong>Couldn’t load incidents</strong>
          <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 220px 1fr 180px 120px",
            gap: 0,
            padding: "10px 12px",
            background: "#f9fafb",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <div>ID</div>
          <div>Occurred At</div>
          <div>Location</div>
          <div>NERIS Incident ID</div>
          <div>Detail</div>
        </div>

        {loadingIncidents ? (
          <div style={{ padding: 12 }}>Loading incidents…</div>
        ) : incidents.length === 0 ? (
          <div style={{ padding: 12 }}>
            No incidents for this department yet. Add one in your backend `/docs`
            under:{" "}
            <code>/api/v1/departments/{`{department_id}`}/incidents/</code>
          </div>
        ) : (
          incidents.map((inc) => (
            <div
              key={inc.id}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 220px 1fr 180px 120px",
                padding: "10px 12px",
                borderTop: "1px solid #e5e7eb",
                alignItems: "center",
              }}
            >
              <div>{inc.id}</div>
              <div>{formatDate(inc.occurred_at)}</div>
              <div>
                {[inc.address, inc.city, inc.state].filter(Boolean).join(", ") || "—"}
              </div>
              <div>{inc.neris_incident_id ?? "—"}</div>
              <div>
                <Link
                  href={`/incidents/${inc.id}?departmentId=${inc.department_id}`}
                  style={{ textDecoration: "underline" }}
                >
                  View →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 13, opacity: 0.8 }}>
        Backend: <code>{baseUrl}</code>
      </div>
    </div>
  );
}
