"use client";

import { useEffect, useState } from "react";

function parseDeptId(raw: string | null): string | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.floor(n));
}

function readDeptIdFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);

    // 1) Prefer explicit query param
    const fromQuery = parseDeptId(url.searchParams.get("departmentId"));
    if (fromQuery) return fromQuery;

    // 2) Infer from /departments/[id]
    const m = url.pathname.match(/^\/departments\/(\d+)(\/|$)/);
    if (m?.[1]) {
      const inferred = parseDeptId(m[1]);
      if (inferred) return inferred;
    }

    return null;
  } catch {
    return null;
  }
}

export default function ActiveDeptChip() {
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);

  useEffect(() => {
    // Load from localStorage first (sticky)
    try {
      const stored = localStorage.getItem("activeDepartmentId");
      if (stored) setActiveDeptId(stored);
    } catch {
      // ignore
    }

    // Upgrade from URL if present (authoritative)
    const fromUrl = readDeptIdFromUrl();
    if (fromUrl) {
      setActiveDeptId(fromUrl);
      try {
        localStorage.setItem("activeDepartmentId", fromUrl);
      } catch {
        // ignore
      }
    }

    // Keep updated on back/forward navigation
    const onPopState = () => {
      const next = readDeptIdFromUrl();
      if (!next) return;
      setActiveDeptId(next);
      try {
        localStorage.setItem("activeDepartmentId", next);
      } catch {
        // ignore
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
