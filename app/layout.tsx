"use client";

import Link from "next/link";
import "./globals.css";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function parseDeptId(raw: string | null): string | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.floor(n));
}

function deptHrefFromId(id?: string | null) {
  return id ? `/departments/${id}` : "/departments";
}

function incidentsHrefFromId(id?: string | null) {
  return id ? `/incidents?departmentId=${id}` : "/incidents";
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);

  // 1) On first mount, load sticky dept from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("activeDepartmentId");
      if (stored) setActiveDeptId(stored);
    } catch {
      // ignore
    }
  }, []);

  // 2) If URL contains departmentId, promote it to “active” and persist
  useEffect(() => {
    const urlDept = parseDeptId(searchParams.get("departmentId"));
    if (!urlDept) return;

    setActiveDeptId(urlDept);
    try {
      localStorage.setItem("activeDepartmentId", urlDept);
    } catch {
      // ignore
    }
  }, [searchParams]);

  // 3) If visiting /departments/[id], infer it and persist
  useEffect(() => {
    const m = pathname.match(/^\/departments\/(\d+)(\/|$)/);
    if (!m?.[1]) return;

    const inferred = parseDeptId(m[1]);
    if (!inferred) return;

    setActiveDeptId(inferred);
    try {
      localStorage.setItem("activeDepartmentId", inferred);
    } catch {
      // ignore
    }
  }, [pathname]);

  const departmentsHref = useMemo(() => deptHrefFromId(activeDeptId), [activeDeptId]);
  const incidentsHref = useMemo(() => incidentsHrefFromId(activeDeptId), [activeDeptId]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-orange-400">FireForge LLC</div>
                <div className="text-xs text-slate-300">InfernoIntelAI – NERIS Portal</div>
              </div>

              <div
                className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200"
                title={
                  activeDeptId
                    ? `Active department context set (ID: ${activeDeptId})`
                    : "No active department set yet. Pick one on the Dashboard."
                }
              >
                <span className="text-slate-400">Active Dept:</span>
                <span className="font-mono">{activeDeptId ?? "not set"}</span>
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

          {!activeDeptId ? (
            <div className="border-t border-slate-800 bg-slate-950/20">
              <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2 text-xs text-slate-400">
                <span>
                  Tip: Select a department on the Dashboard to keep navigation locked to that department.
                </span>
                <Link href="/dashboard" className="text-orange-300 hover:text-orange-200">
                  Go to Dashboard →
                </Link>
              </div>
            </div>
          ) : null}
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
