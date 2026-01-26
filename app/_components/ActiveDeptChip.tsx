"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function parseDeptId(raw: string | null): string | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.floor(n));
}

function inferDeptIdFromPath(pathname: string): string | null {
  // /departments/123
  const m = pathname.match(/^\/departments\/(\d+)(\/|$)/);
  if (!m?.[1]) return null;
  return parseDeptId(m[1]);
}

export default function ActiveDeptChip() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derived department ID from URL (query param wins)
  const deptFromUrl = useMemo(() => {
    const fromQuery = parseDeptId(searchParams.get("departmentId"));
    if (fromQuery) return fromQuery;
    return inferDeptIdFromPath(pathname);
  }, [pathname, searchParams]);

  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);

  // On first mount, hydrate from localStorage for stickiness
  useEffect(() => {
    try {
      const stored = localStorage.getItem("activeDepartmentId");
      if (stored) setActiveDeptId(stored);
    } catch {
      // ignore
    }
  }, []);

  // ✅ Critical: whenever the URL changes, update the chip and persist
  useEffect(() => {
    if (!deptFromUrl) return;

    setActiveDeptId(deptFromUrl);
    try {
      localStorage.setItem("activeDepartmentId", deptFromUrl);
    } catch {
      // ignore
    }
  }, [deptFromUrl]);

  return (
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
  );
}
