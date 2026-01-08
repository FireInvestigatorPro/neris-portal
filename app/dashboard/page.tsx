import Link from "next/link";
import { headers } from "next/headers";

async function getBackendHealth() {
  try {
    const h = await headers(); // <-- FIX: await headers()

    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const base = host ? `${proto}://${host}` : "";

    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("health not ok");

    return "online" as const;
  } catch {
    return "down" as const;
  }
}

export default async function DashboardPage() {
  const backendStatus = await getBackendHealth();

  return (
    <div className="space-y-8">
      {/* VALUE PANEL */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ValueCard
          title="Operational Readiness"
          value="Active"
          subtitle="System online & cases tracked"
        />
        <ValueCard
          title="Open Investigations"
          value="1"
          subtitle="Current department"
        />
        <ValueCard
          title="NFPA 921 Alignment"
          value="Enabled"
          subtitle="Structured documentation"
        />
        <ValueCard
          title="Backend Status"
          value={backendStatus === "online" ? "Online" : "Offline"}
          subtitle="Live data connection"
          status={backendStatus}
        />
      </section>

      {/* QUICK ACTIONS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickAction
          title="View Incidents"
          description="Review active and historical cases"
          href="/incidents"
        />
        <QuickAction
          title="Add New Incident"
          description="Create a new investigation record"
          href="/incidents/new"
        />
        <QuickAction
          title="Department Overview"
          description="Command-level department snapshot"
          href="/departments"
        />
      </section>

      {/* COMMAND NOTE */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-sm font-semibold text-orange-400">
          Command Visibility
        </h3>
        <p className="mt-2 text-sm text-slate-300">
          InfernoIntelAI provides a structured, defensible record of fire
          investigations aligned with NFPA 921 methodology. Designed for
          investigators. Built for command staff.
        </p>
      </section>
    </div>
  );
}

function ValueCard({
  title,
  value,
  subtitle,
  status,
}: {
  title: string;
  value: string;
  subtitle: string;
  status?: "online" | "down";
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        {status && (
          <span
            className={`h-2 w-2 rounded-full ${
              status === "online" ? "bg-green-500" : "bg-red-500"
            }`}
          />
        )}
      </div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 hover:border-orange-500/60 transition"
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-2 text-sm text-slate-400">{description}</div>
    </Link>
  );
}
