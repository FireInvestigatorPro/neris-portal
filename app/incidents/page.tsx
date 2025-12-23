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

type Incident = {
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

export default function IncidentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | "">("");

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [occurredAt, setOccurredAt] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("MA");
  const [nerisIncidentId, setNerisIncidentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const canCreate = useMemo(() => {
    return selectedDeptId !== "" && nerisIncidentId.trim().length > 0;
  }, [selectedDeptId, nerisIncidentId]);

  async function loadDepartments() {
    const res = await fetch("/api/departments", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || `Failed to load departments (${res.status})`);
    return Array.isArray(data) ? (data as Department[]) : [];
  }

  async function loadIncidents(deptId: number) {
    const res = await fetch(`/api/departments/${deptId}/incidents`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || `Failed to load incidents (${res.status})`);
    return Array.isArray(data) ? (data as Incident[]) : [];
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const deps = await loadDepartments();
      setDepartments(deps);

      // pick default department if none selected
      const effectiveDeptId =
        selectedDeptId === "" ? deps[0]?.id : (selectedDeptId as number);

      if (effectiveDeptId) {
        setSelectedDeptId(effectiveDeptId);
        const inc = await loadIncidents(effectiveDeptId);
        setIncidents(inc);
      } else {
        setIncidents([]);
      }
    } catch (e: any) {
      setError(e?.message || "Couldn’t load incidents");
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDeptChange(val: string) {
    const id = Number(val);
    if (!Number.isFinite(id)) return;
    setSelectedDeptId(id);
    setLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const inc = await loadIncidents(id);
      setIncidents(inc);
    } catch (e: any) {
      setError(e?.message || "Couldn’t load incidents");
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }

  async function createIncident() {
    if (!canCreate || selectedDeptId === "") return;
    setSaving(true);
    setError(null);
    setStatusMsg(null);

    try {
      const payload = {
        occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
        address: address.trim() || null,
        city: (city.trim() || null) as string | null,
        state: (state.trim() || null) as string | null,
        neris_incident_id: nerisIncidentId.trim(),
      };

      const res = await fetch(`/api/departments/${selectedDeptId}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `Create failed (${res.status})`);

      setStatusMsg(`Created incident: ${data.neris_incident_id || data.id}`);
      setOccurredAt("");
      setAddress("");
      setCity("");
      setState("MA");
      setNerisIncidentId("");

      const inc = await loadIncidents(selectedDeptId);
      setIncidents(inc);
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Incidents</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Department</span>
          <select
            value={selectedDeptId === "" ? "" : String(selectedDeptId)}
            onChange={(e) => onDeptChange(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
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
        </label>

        <button
          onClick={refresh}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>

        {statusMsg && <span style={{ fontSize: 13 }}>{statusMsg}</span>}
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          marginBottom: 18,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Create Incident</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>NERIS Incident ID (required)</span>
            <input
              value={nerisIncidentId}
              onChange={(e) => setNerisIncidentId(e.target.value)}
              placeholder="2025-FR-001"
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Occurred At</span>
            <input
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              placeholder="2025-12-15 15:58"
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Fall River"
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>State</span>
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="MA"
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
            />
          </label>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={createIncident}
            disabled={!canCreate || saving}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: saving ? "#9ca3af" : "#111827",
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Creating..." : "Create Incident"}
          </button>
        </div>

        {error && <p style={{ marginTop: 10, color: "#b91c1c" }}>{error}</p>}
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Incident List</h2>

        {loading ? (
          <p>Loading…</p>
        ) : incidents.length === 0 ? (
          <p>No incidents for this department yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 8px" }}>ID</th>
                <th style={{ padding: "10px 8px" }}>NERIS Incident ID</th>
                <th style={{ padding: "10px 8px" }}>Occurred</th>
                <th style={{ padding: "10px 8px" }}>Location</th>
                <th style={{ padding: "10px 8px" }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 8px" }}>{i.id}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace" }}>
                    {i.neris_incident_id || "—"}
                  </td>
                  <td style={{ padding: "10px 8px" }}>{i.occurred_at || "—"}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {[i.address, i.city, i.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <Link href={`/incidents/${i.id}`}>Detail</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
