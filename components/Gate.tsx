"use client";

import { useEffect, useState } from "react";
import { readableFg, softTint, type Brand } from "@/lib/branding";
import { Button } from "./Button";

// Email access gate. The visitor enters their email; if its domain or exact
// address is allowed, the server issues a session cookie and we reload into the
// demo. Enforcement is server-side — this is just the unlock UI.
export function Gate({ brand, slug }: { brand: Brand; slug: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand", brand.color);
    root.style.setProperty("--brand-fg", readableFg(brand.color));
    root.style.setProperty("--brand-soft", softTint(brand.color, 0.1));
  }, [brand.color]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/p/${encodeURIComponent(slug)}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error || "That email isn't on the access list for this demo.");
      setBusy(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo} alt={brand.product} className="h-7 w-auto max-w-[150px] object-contain" />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold"
              style={{ background: "var(--brand)", color: "var(--brand-fg)" }}
            >
              {brand.product.charAt(0)}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">This demo is private</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter your email to access the {brand.product} migration demo. Access is limited to
            invited domains.
          </p>

          <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
            <input
              type="email"
              autoFocus
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={busy} className="w-full">
              Continue
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-400">
          Powered by{" "}
          <a href="https://docs.vern.so/migration-api/introduction" className="font-medium text-zinc-500">
            Vern
          </a>
        </p>
      </div>
    </main>
  );
}
