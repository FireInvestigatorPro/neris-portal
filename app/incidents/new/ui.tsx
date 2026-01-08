"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Dept = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id?: string;
};

function toLocalInputValue(d: Date) {
  // yyyy-MM-ddTHH:mm (local)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewIncidentForm({ initialDepartmentId }: { initialDepartmentId?: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Dept[] | null>(null);
  const [deptId, setDeptId] = useState<string>(initialDepartmentId ?? "");

  const [occurredAtLocal, setOccurredAtLocal] = useState(() => toLocalInputValue(new Date()));
  const [address, setAddress] = useState("123 Main St");
  const [city, setCity] = useState("Fall River");
  const [state, setState] = useState("MA");
  const [nerisIncidentId, setNerisIncidentId] = useState("2026-FR-NEW");

  const occurredAtUtcISO = useMemo(() => {
    // Convert local input to UTC ISO
    const d = new Date(occurredAtLocal);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
  }, [occurredAtLocal]);

  async function ensureDepartmentsLoaded() {
    if (departments) return;
    const res = await fetch("/api/departments", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load departments (${res.status})`);
    const data = (await res.json()) as Dept[];
    setDepartments(data);
    if (!deptId && data?.[0]?.id) setDeptId(String(data[0].id));
  }

  async function onFocusDeptSelect() {
    try {
      await ensureDepartmentsLoaded();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load departments");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!deptId) {
      setErr("Pick a department first.");
      return;
    }
    if (!occurredAtUtcISO) {
      setErr("Occurred At looks invalid.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(deptId)}/incidents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          occurred_at: occurredAtUtcISO,
          address,
          city,
          state,
          neris_incident_id: nerisIncidentId,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Create failed (${res.status}). ${text}`);
      }

      const created = JSON.parse(text) as { id: number; department_id: number };
      router.push(`/incidents/${created.id}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-300">Department</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              onFocus={onFocusDeptSelect}
            >
              <option value="">Select…</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.city}, {d.state}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Tip: load the dropdown once and you’re good.
            </p>
          </div>

          <div>
            <label className="text-sm text-slate-300">Occurred At (Local)</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={occurredAtLocal}
              onChange={(e) => setOccurredAtLocal(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              UTC: <span className="font-mono">{occurredAtUtcISO || "—"}</span>
            </p>
          </div>

          <div>
            <label className="text-sm text-slate-300">Address</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300">City</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">State</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-300">NERIS Incident ID</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={nerisIncidentId}
              onChange={(e) => setNerisIncidentId(e.target.value)}
            />
          </div>
        </div>

        {err ? (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm hover:border-slate-600"
            onClick={() => router.push("/dashboard")}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Creating…" : "Create Incident"}
          </button>
        </div>
      </form>
    </div>
  );
}
