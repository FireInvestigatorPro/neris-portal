"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type CreateIncidentPayload = {
  occurred_at: string; // ISO string
  address: string;
  city: string;
  state: string;
  neris_incident_id?: string | null;
};

function toIsoOrNow(input: string) {
  // Accepts "YYYY-MM-DDTHH:mm" from <input type="datetime-local">
  // Converts to ISO; if empty, uses now.
  const d = input ? new Date(input) : new Date();
  return d.toISOString();
}

function NewIncidentInner() {
  const router = useRouter();
  const search = useSearchParams();

  const departmentIdStr = search?.get("departmentId") ?? "";
  const departmentId = Number(departmentIdStr);

  const isValidDepartment = useMemo(
    () => Number.isFinite(departmentId) && departmentId > 0,
    [departmentId]
  );

  const [occurredLocal, setOccurredLocal] = useState(""); // datetime-local
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Fall River");
  const [state, setState] = useState("MA");
  const [nerisIncidentId, setNerisIncidentId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidDepartment) {
      setError(
        'Missing/invalid departmentId. Go back and select a department first.'
      );
      return;
    }

    if (!address.trim()) {
      setError("Address is required.");
      return;
    }

    const payload: CreateIncidentPayload = {
      occurred_at: toIsoOrNow(occurredLocal),
      address: address.trim(),
      city: city.trim() || "",
      state: state.trim() || "",
      neris_incident_id: nerisIncidentId.trim() ? nerisIncidentId.trim() : null,
    };

    setSubmitting(true);
    try {
      // Expects your Next API route:
      // /api/departments/:id/incidents  (POST)
      const res = await fetch(`/api/departments/${departmentId}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(`Create failed (${res.status}). ${text}`);
      }

      const created = text ? JSON.parse(text) : null;
      const newId = created?.id;

      if (!newId) {
        router.push(`/departments/${departmentId}/incidents`);
        return;
      }

      router.push(`/incidents/${newId}?departmentId=${departmentId}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create incident.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">
            New Incident
          </h1>
          <p className="text-xs text-slate-300">
            {isValidDepartment ? (
              <>
                Creating incident for Dept ID:{" "}
                <span className="text-slate-100">{departmentId}</span>
              </>
            ) : (
              <>
                Select a department first (missing{" "}
                <span className="text-slate-100">departmentId</span>).
              </>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          {isValidDepartment ? (
            <Link
              href={`/departments/${departmentId}/incidents`}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
            >
              ← Back to Dept Incidents
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
            >
              ← Back to Dashboard
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
          <p className="text-xs whitespace-pre-wrap text-red-300">{error}</p>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-400">
              Occurred (Local)
            </label>
            <input
              type="datetime-local"
              value={occurredLocal}
              onChange={(e) => setOccurredLocal(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/50 px-2 py-2 text-xs text-slate-100 focus:border-orange-400 focus:outline-none"
            />
            <div className="mt-1 text-[11px] text-slate-500">
              If blank, we’ll use “now” (UTC) for demo speed.
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-400">
              NERIS Incident ID (optional)
            </label>
            <input
              value={nerisIncidentId}
              onChange={(e) => setNerisIncidentId(e.target.value)}
              placeholder="e.g., 2026-FR-001"
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/50 px-2 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-orange-400 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-400">
            Address
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St"
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/50 px-2 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-orange-400 focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-400">
              City
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/50 px-2 py-2 text-xs text-slate-100 focus:border-orange-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-400">
              State
            </label>
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/50 px-2 py-2 text-xs text-slate-100 focus:border-orange-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            This creates the incident in your Render DB via your Next API route.
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md border border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-100 hover:border-orange-400 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create Incident"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function NewIncidentPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
          Loading…
        </div>
      }
    >
      <NewIncidentInner />
    </Suspense>
  );
}
