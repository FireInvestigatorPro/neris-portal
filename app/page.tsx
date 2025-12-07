// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-orange-400">
        InfernoIntelAI NERIS Hotspot Intelligence
      </h1>
      <p className="max-w-2xl text-sm text-slate-200">
        Web-based tools for fire departments and investigators to harness NERIS
        incident data, identify hotspots, and power grant applications.
        Designed and built by a working fire investigator for the real world.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow hover:bg-orange-400"
        >
          Investigator Login
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-orange-400 hover:text-orange-300"
        >
          View Demo Dashboard
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-orange-300">
            NERIS Hotspot Intelligence
          </h2>
          <p className="mt-2 text-xs text-slate-200">
            Upload or connect your NERIS exports and visualize incident
            clusters by census tract, time of day, and incident type.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-orange-300">
            Grant Assistant Engine
          </h2>
          <p className="mt-2 text-xs text-slate-200">
            Turn data into narratives and justifications for AFG, SAFER,
            FP&S, and state-level fire service grants.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-orange-300">
            Admin Tools & Compliance
          </h2>
          <p className="mt-2 text-xs text-slate-200">
            Role-based access, department management, and NFPA-aligned
            workflows tailored to fire investigation units.
          </p>
        </div>
      </div>
    </section>
  );
}
