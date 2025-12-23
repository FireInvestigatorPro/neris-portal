// app/login/LoginClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const n = searchParams.get("next");
    // basic safety: only allow internal redirects
    if (!n || !n.startsWith("/")) return "/dashboard";
    return n;
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Login failed (${res.status})`);
      }

      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Sign in</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@department.gov"
            type="email"
            autoComplete="email"
            required
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.15)",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
            required
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.15)",
            }}
          />
        </label>

        {error ? (
          <div style={{ fontSize: 13, color: "#ffb4b4" }}>{error}</div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          After login you’ll be sent to: <code>{nextPath}</code>
        </div>
      </form>
    </div>
  );
}
