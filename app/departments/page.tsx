"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Department = {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  neris_department_id: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_API_BASE = "https://infernointelai-backend.onrender.com";

/**
 * Uses NEXT_PUBLIC_API_BASE_URL if you set it in Vercel.
 * Otherwise falls back to your Render backend URL above.
 */
function getApiBase() {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  return v && v.length > 0 ? v : DEFAULT_API_BASE;
}

async function safeReadText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export default function DepartmentsPage() {
  const apiBase = useMemo(() => getApiBase(), []);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("Fall River Fire Department");
  const [city, setCity] = useState("Fall River");
  const [stateVal, setStateVal] = useState("MA");
  const [nerisDepartmentId, setNerisDepartmentId] = useState("FRFD-001");

  async function loadDepartments() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/v1/departments/`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await safeReadText(res);
        throw new Error(`Failed to load departments (${res.status}). ${text}`);
      }

      const data = (await res.json()) as Department[];
      setDepartments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDepartment() {
    setBusy(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        city: city.trim(),
        state: stateVal.trim(),
        neris_department_id: nerisDepartmentId.trim(),
      };

      // Minimal validation for demo sanity
      if (!payload.name) throw new Error("Name is required.");
      if (!payload.city) throw new Error("City is required.");
      if (!payload.state) throw new Error("State is required.");
      if (!payload.neris_department_id) throw new Error("NERIS Dept ID is required.");

      const res = await fetch(`${apiBase}/api/v1/departments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await safeReadText(res);
        throw new Error(`Create failed (${res.status}). ${text}`);
      }

      // Reload list so timestamps match DB
      await loadDepartments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDepartment(departmentId: number) {
    const ok = confirm(
      `Delete department ${departmentId}?\n\nThis will also delete its incidents (cascade).`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/v1/departments/${departmentId}`, {
        method: "DELETE",
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await safeReadText(res);
        throw new Error(`Delete failed (${res.status}). ${text}`);
      }

      await loadDepartments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Departments</h1>
          <p className="text-xs text-slate-300">
            Live data from your Render backend (safe demo mode).
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            API: <span className="text-slate-300">{apiBase}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadDepartments()}
            disabled={loading || busy}
            className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:border-orange-400 disabled:opacity-50"
          >
            Refresh
          </button>

          <Link
            href="/"
            className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:border-orange-400"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Create Department */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-slate-100">Create Department</div>
          <div className="text-[11px] text-slate-400">
            Tip: keep this clean for demo clients.
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-[11px] text-slate-400">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-400"
              placeholder="Fall River Fire Department"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] text-slate-400">NERIS Department ID</div>
            <input
              value={nerisDepartmentId}
              onChange={(e) => setNerisDepartmentId(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-400"
              placeholder="FRFD-001"
            />
            <div className="mt-1 text-[10px] text-slate-500">
              This is your “external” ID for matching later when you import real NERIS data.
            </div>
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] text-slate-400">City</div>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-400"
              placeholder="Fall River"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] text-slate-400">State</div>
            <input
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-400"
              placeholder="MA"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => void createDepartment()}
            disabled={busy}
            className="rounded-lg border border-orange-400 bg-orange-400/10 px-3 py-2 text-xs text-orange-200 hover:bg-orange-400/15 disabled:opacity-50"
          >
            {busy ? "Working…" : "Create Department"}
          </button>

          <a
            href={`${apiBase}/docs`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-300 hover:text-orange-200"
          >
            Open API Docs →
          </a>
        </div>
      </div>

      {/* Errors */}
      {error ? (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-200">
          <div className="font-semibold">Something went sideways</div>
          <div className="mt-2 whitespace-pre-wrap text-[11px] text-red-100/90">
            {error}
          </div>
          <div className="mt-3 text-[11px] text-slate-200/80">
            Quick check: open{" "}
            <span className="text-slate-100">{apiBase}/docs</span> and try GET{" "}
            <span className="text-slate-100">/api/v1/departments/</span>.
          </div>
        </div>
      ) : null}

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
            Loading departments…
          </div>
        ) : departments.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
            No departments yet. Create one above to see it here.
          </div>
        ) : (
          departments.map((dept) => (
            <div
              key={dept.id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs"
            >
              <div className="flex items-start justify-between gap-4">
                <Link
                  href={`/departments/${dept.id}`}
                  className="block hover:opacity-90"
                >
                  <div className="font-semibold text-slate-100">{dept.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {(dept.city ?? "—")}, {(dept.state ?? "—")}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    NERIS Dept ID:{" "}
                    <span className="text-slate-300">
                      {dept.neris_department_id ?? "—"}
                    </span>
                  </div>
                </Link>

                <div className="text-right text-[10px] text-slate-500">
                  <div>Created: {new Date(dept.created_at).toLocaleString()}</div>
                  <div>Updated: {new Date(dept.updated_at).toLocaleString()}</div>

                  <button
                    onClick={() => void deleteDepartment(dept.id)}
                    disabled={busy}
                    className="mt-2 rounded-md border border-red-900/60 bg-red-950/30 px-2 py-1 text-[10px] text-red-200 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-2 text-[11px] text-slate-500">
        Demo goal: a department admin can create their department + basic test incidents without touching backend tools.
      </div>
    </section>
  );
}
