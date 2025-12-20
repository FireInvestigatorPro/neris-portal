"use client";

import React, { useEffect, useMemo, useState } from "react";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id: string;
  created_at: string;
  updated_at: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://infernointelai-backend.onrender.com";

const DEPARTMENTS_URL = `${API_BASE}/api/v1/departments/`;

function formatUtc(iso: string) {
  // Keep it simple + consistent for demo
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toISOString().replace("T", " ").replace("Z", " UTC");
  } catch {
    return iso;
  }
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("Fall River Fire Department");
  const [city, setCity] = useState("Fall River");
  const [stateVal, setStateVal] = useState("MA");
  const [nerisDepartmentId, setNerisDepartmentId] = useState("FRFD-001");

  const hasForm = useMemo(() => {
    return (
      name.trim().length > 0 &&
      city.trim().length > 0 &&
      stateVal.trim().length > 0 &&
      nerisDepartmentId.trim().length > 0
    );
  }, [name, city, stateVal, nerisDepartmentId]);

  async function loadDepartments() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(DEPARTMENTS_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        // Avoid caching for live demo feel
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`GET /departments failed (${res.status}). ${text}`.trim());
      }

      const data = (await res.json()) as Department[];
      // Sort friendly
      data.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      setDepartments(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load departments.");
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!hasForm || busy) return;

    setBusy(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        city: city.trim(),
        state: stateVal.trim(),
        neris_department_id: nerisDepartmentId.trim(),
      };

      const res = await fetch(DEPARTMENTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // FastAPI often returns {"detail": "..."} — but sometimes plain text
        let detail = "";
        try {
          const j = await res.json();
          detail = typeof j?.detail === "string" ? j.detail : JSON.stringify(j);
        } catch {
          detail = await res.text().catch(() => "");
        }
        throw new Error(`POST /departments failed (${res.status}). ${detail}`.trim());
      }

      // Success — refresh list
      await loadDepartments();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create department.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-orange-400">Departments</h1>
        <p className="text-sm text-slate-300">
          Live data from your Render backend:{" "}
          <span className="font-mono text-slate-200">{API_BASE}</span>
        </p>
        <p className="text-xs text-slate-400">
          Tip: set <span className="font-mono">NEXT_PUBLIC_API_BASE_URL</span> in Vercel to
          point this UI at a different backend.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
          <div className="font-semibold">Something failed</div>
          <div className="mt-1 whitespace-pre-wrap font-mono text-xs">{error}</div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Create Department</h2>
            <p className="text-xs text-slate-400">
              For the demo portal, this keeps onboarding dead simple.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDepartments()}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900 disabled:opacity-60"
            disabled={loading || busy}
            title="Refresh"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <form onSubmit={createDepartment} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs text-slate-400">Name</div>
            <input
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500/60"
              placeholder="Fall River Fire Department"
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-400">NERIS Department ID</div>
            <input
              value={nerisDepartmentId}
              onChange={(ev) => setNerisDepartmentId(ev.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500/60"
              placeholder="FRFD-001"
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-400">City</div>
            <input
              value={city}
              onChange={(ev) => setCity(ev.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500/60"
              placeholder="Fall River"
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-400">State</div>
            <input
              value={stateVal}
              onChange={(ev) => setStateVal(ev.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500/60"
              placeholder="MA"
              maxLength={10}
            />
          </label>

          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={!hasForm || busy}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create Department"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Department List</h2>
          <div className="text-xs text-slate-400">
            {loading ? "Loading…" : `${departments.length} total`}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
              Pulling live data…
            </div>
          ) : departments.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
              No departments yet. Create one above to get rolling.
            </div>
          ) : (
            departments.map((dept) => (
              <div
                key={dept.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-base font-semibold text-slate-100">{dept.name}</div>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                        ID {dept.id}
                      </span>
                    </div>

                    <div className="text-sm text-slate-300">
                      {dept.city}, {dept.state} •{" "}
                      <span className="font-mono text-slate-200">{dept.neris_department_id}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400">
                    <div>
                      Created: <span className="font-mono">{formatUtc(dept.created_at)}</span>
                    </div>
                    <div>
                      Updated: <span className="font-mono">{formatUtc(dept.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <footer className="text-xs text-slate-500">
        Next step after this page: add an “Incidents” view for a selected department (create,
        list, update, delete) so a pilot department can actually test-drive the flow end-to-end.
      </footer>
    </section>
  );
}
