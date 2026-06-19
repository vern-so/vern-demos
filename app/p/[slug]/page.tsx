import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProspect } from "@/lib/demo-config";
import { resolveAccess } from "@/lib/access";
import { DemoApp } from "@/components/DemoApp";
import { Gate } from "@/components/Gate";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProspect(slug).catch(() => null);
  const product = p?.product || "Acme";
  return {
    title: `Import your data — ${product}`,
    description: `See your data migrated cleanly into ${product}, live.`,
    robots: { index: false, follow: false },
    // Favicon = the prospect's own logo, so the tab feels like their product.
    ...(p?.logo_url ? { icons: { icon: [{ url: p.logo_url }] } } : {}),
  };
}

export default async function ProspectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveAccess(slug);
  if (!access.exists) notFound();

  return access.allowed ? (
    <DemoApp brand={access.brand} slug={slug} />
  ) : (
    <Gate brand={access.brand} slug={slug} />
  );
}
