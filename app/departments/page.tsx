"use client";

import { useEffect, useMemo, useState } from "react";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id: string;
  created_at?: string;
  updated_at?: string;
};

export default function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("MA");
  const [nerisId, setNerisId] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return name.trim() && city.trim() && state.trim() && nerisId.trim();
  }, [name, city, state, nerisId]);

  async function load() {
    setLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/departments", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.detail || `Failed to load departments (${res.status})`;
        throw new Error(msg);
      }

      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Couldn’t load departments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createDepartment() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setStatusMsg(null);

    try {
      const payload = {
        name: name.trim(),
        city: city.trim(),
        state: state.trim(),
        neris_department_id: nerisId.trim(),
      };

      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.detail || `Create failed (${res.status})`;
        throw new Error(msg);
      }

      setStatusMsg(`Created: ${data.name}`);
      setName("");
      setCity("");
      setState("MA");
      setNerisId("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Departments</h1>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          marginBottom: 18,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Create Department</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fall River Fire Department"
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>NERIS Department ID</span>
            <input
              value={nerisId}
              onChange={(e) => setNerisId(e.target.value)}
              placeholder="FRFD-001"
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
            onClick={createDepartment}
            disabled={!canSubmit || saving}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: saving ? "#9ca3af" : "#111827",
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Creating..." : "Create"}
          </button>

          <button
            onClick={load}
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

        {error && <p style={{ marginTop: 10, color: "#b91c1c" }}>{error}</p>}
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Department List</h2>

        {loading ? (
          <p>Loading…</p>
        ) : items.length === 0 ? (
          <p>No departments yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 8px" }}>ID</th>
                <th style={{ padding: "10px 8px" }}>Name</th>
                <th style={{ padding: "10px 8px" }}>City</th>
                <th style={{ padding: "10px 8px" }}>State</th>
                <th style={{ padding: "10px 8px" }}>NERIS ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 8px" }}>{d.id}</td>
                  <td style={{ padding: "10px 8px" }}>{d.name}</td>
                  <td style={{ padding: "10px 8px" }}>{d.city}</td>
                  <td style={{ padding: "10px 8px" }}>{d.state}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace" }}>{d.neris_department_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
