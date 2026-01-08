// app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold">Demo Login</h1>
      <p className="mt-2 text-sm text-slate-300">
        Enter your demo email to access the portal.
      </p>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <Suspense fallback={<div className="text-sm text-slate-300">Loading…</div>}>
          <LoginClient />
        </Suspense>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        After login you’ll be sent to: <span className="font-mono">/dashboard</span>
      </p>
    </div>
  );
}
