import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProspect, DEFAULT_SLUG } from "@/lib/demo-config";
import { resolveAccess } from "@/lib/access";
import { DemoApp } from "@/components/DemoApp";
import { Gate } from "@/components/Gate";
import { DOCS_URL, SOURCE_URL } from "@/lib/site";
import { hasRegistry } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = { robots: { index: false, follow: false } };
  if (hasRegistry()) return { ...base, title: "Embedded migration demos" };
  const p = await getProspect(DEFAULT_SLUG).catch(() => null);
  const product = p?.product || "Acme";
  return {
    ...base,
    title: `Import your data — ${product}`,
    description: `See your data migrated cleanly into ${product}, live.`,
    ...(p?.logo_url ? { icons: { icon: [{ url: p.logo_url }] } } : {}),
  };
}

export default async function Home() {
  if (hasRegistry()) notFound();

  const access = await resolveAccess(DEFAULT_SLUG);
  if (!access.exists) return <SetupNotice />;

  return access.allowed ? (
    <DemoApp brand={access.brand} slug={DEFAULT_SLUG} />
  ) : (
    <Gate brand={access.brand} slug={DEFAULT_SLUG} />
  );
}

function SetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md">
        <h1 className="text-lg font-semibold text-zinc-900">Almost there</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Set <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-700">VERN_API_KEY</code> in your{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-700">.env.local</code> to run the demo.
          See{" "}
          <a href={SOURCE_URL} className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700">
            the README
          </a>{" "}
          for setup, or grab a key from{" "}
          <a href={DOCS_URL} className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700">
            the docs
          </a>
          .
        </p>
      </div>
    </main>
  );
}
