import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "InfernoIntelAI NERIS Portal",
  description: "NERIS Hotspot Intelligence & Grant Assistant by FireForge LLC",
};

function deptHrefFromId(id?: string | null) {
  return id ? `/departments/${id}` : "/departments";
}

function incidentsHrefFromId(id?: string | null) {
  return id ? `/incidents?departmentId=${id}` : "/incidents";
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Next 16: cookies() is async
  const cookieStore = await cookies();

  const selectedDeptId =
    cookieStore.get("neris_selected_department_id")?.value ??
    cookieStore.get("selected_department_id")?.value ??
    cookieStore.get("department_id")?.value ??
    null;

  const departmentsHref = deptHrefFromId(selectedDeptId);
  const incidentsHref = incidentsHrefFromId(selectedDeptId);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-orange-400">
                  FireForge LLC
                </div>
                <div className="text-xs text-slate-300">
                  InfernoIntelAI – NERIS Portal
                </div>
              </div>

              {/* Server-side chip (may show "not set" until we wire the client chip next) */}
              <div
                className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200"
                title={
                  selectedDeptId
                    ? `Active department context set (ID: ${selectedDeptId})`
                    : "No active department cookie set yet."
                }
              >
                <span className="text-slate-400">Active Dept:</span>
                <span className="font-mono">{selectedDeptId ?? "not set"}</span>
              </div>
            </div>

            <nav className="flex items-center gap-4 text-sm">
              <Link className="hover:text-orange-400" href="/">
                Home
              </Link>
              <Link className="hover:text-orange-400" href="/login">
                Login
              </Link>
              <Link className="hover:text-orange-400" href="/dashboard">
                Dashboard
              </Link>
              <Link className="hover:text-orange-400" href={incidentsHref}>
                Incidents
              </Link>
              <Link className="hover:text-orange-400" href={departmentsHref}>
                Departments
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>

        <footer className="mt-12 border-t border-slate-800 bg-slate-900/60">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 text-xs text-slate-400">
            <span>© {new Date().getFullYear()} FireForge Expert Consulting LLC</span>
            <span>NFPA 921-aligned tools for fire investigators</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
