// app/departments/page.tsx
import Link from "next/link";

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
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE;
}

async function fetchDepartments(): Promise<Department[]> {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/v1/departments/`, {
    // Important so you always see fresh DB data in a demo
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load departments (${res.status}). ${text}`);
  }

  return res.json();
}

export default async function DepartmentsPage() {
  let departments: Department[] = [];
  let error: string | null = null;

  try {
    departments = await fetchDepartments();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Departments</h1>
          <p className="text-xs text-slate-300">
            Live data from your Render backend.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            API: <span className="text-slate-300">{getApiBase()}</span>
          </p>
        </div>

        <Link
          href="/"
          className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:border-orange-400"
        >
          ← Back
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-200">
          <div className="font-semibold">Couldn’t load departments</div>
          <div className="mt-2 whitespace-pre-wrap text-[11px] text-red-100/90">
            {error}
          </div>
          <div className="mt-3 text-[11px] text-slate-200/80">
            Quick check: open{" "}
            <span className="text-slate-100">
              {getApiBase()}/docs
            </span>{" "}
            and try GET <span className="text-slate-100">/api/v1/departments/</span>.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {departments.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
              No departments yet. Create one in <span className="text-slate-100">/docs</span> to see it here.
            </div>
          ) : (
            departments.map((dept) => (
              <Link
                key={dept.id}
                href={`/departments/${dept.id}`}
                className="block rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs hover:border-orange-400"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-100">{dept.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {(dept.city ?? "—")}, {(dept.state ?? "—")}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      NERIS Dept ID:{" "}
                      <span className="text-slate-300">{dept.neris_department_id ?? "—"}</span>
                    </div>
                  </div>

                  <div className="text-right text-[10px] text-slate-500">
                    <div>Created: {new Date(dept.created_at).toLocaleString()}</div>
                    <div>Updated: {new Date(dept.updated_at).toLocaleString()}</div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </section>
  );
}
