"use client";

import { useEffect, useRef, useState } from "react";
import type { Brand } from "@/lib/branding";
import { BOOK_A_CALL_URL, DOCS_URL, SOURCE_URL } from "@/lib/site";
import { GitHubIcon, GridIcon } from "./Icons";

const AVATAR_URL =
  "https://media.licdn.com/dms/image/v2/D5603AQFSXl-lDGyYeg/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1730434970300?e=2147483647&v=beta&t=Tdvsl3EYK2r7k_rpqzCrX6-XPalkqNCm2f8qN8TlkOw";

// A neutral, believable "product" chrome so the embedded import flow reads as if
// it lives inside the prospect's own app. Branding comes from URL params.
export function Shell({
  brand,
  navItems = [],
  children,
}: {
  brand: Brand;
  navItems?: string[];
  children: React.ReactNode;
}) {
  // The dummy product's sidebar lists the prospect's actual objects (their Vern
  // templates), so the import feels like it lives inside their real app.
  const objectItems = navItems.slice(0, 5);
  return (
    <div className="min-h-screen w-full bg-[#fafafa]">
      <div className="mx-auto flex min-h-screen max-w-[1180px]">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-200/70 px-4 py-5 md:flex">
          <div className="flex items-center gap-2.5 px-2">
            {brand.logo ? (
              // Logo lockups usually include the wordmark, so render it alone at a
              // fixed height with auto width rather than forcing a square.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo} alt={brand.product} className="h-7 w-auto max-w-[150px] object-contain" />
            ) : (
              <>
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold"
                  style={{ background: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  {brand.product.charAt(0)}
                </div>
                <span className="truncate text-sm font-semibold text-zinc-800">{brand.product}</span>
              </>
            )}
          </div>

          <nav className="mt-7 flex flex-col gap-0.5">
            <NavRow label="Home" />
            {objectItems.map((item) => (
              <NavRow key={item} label={item} />
            ))}
            <div className="my-2 h-px bg-zinc-100" />
            <NavRow label="Data import" active />
            <NavRow label="Settings" />
          </nav>

          <div className="mt-auto px-2">
            <PoweredByVern />
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-zinc-200/70 px-6">
            <div className="text-sm text-zinc-400">
              <span className="text-zinc-500">{brand.product}</span>
              <span className="mx-1.5">/</span>
              <span className="text-zinc-700">Data import</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500">
                Interactive demo
              </span>
              <SourceLink />
              <AvatarMenu />
            </div>
          </header>

          <div className="flex-1 px-6 py-8 sm:px-10">{children}</div>

          <div className="px-6 py-4 md:hidden">
            <PoweredByVern />
          </div>
        </main>
      </div>
    </div>
  );
}

function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white p-0.5 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AVATAR_URL} alt="" className="h-full w-full rounded-full object-cover" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <MenuLink href={BOOK_A_CALL_URL} onClick={() => setOpen(false)}>
            Book setup call
          </MenuLink>
          <MenuLink href={DOCS_URL} onClick={() => setOpen(false)}>
            View docs
          </MenuLink>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <a
      role="menuitem"
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className="block px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
    >
      {children}
    </a>
  );
}

function SourceLink() {
  return (
    <div className="group relative">
      <a
        href={SOURCE_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="View source on GitHub"
        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
      >
        <GitHubIcon className="h-[18px] w-[18px]" />
      </a>
      <span className="pointer-events-none absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
        View source
      </span>
    </div>
  );
}

function NavRow({ label, active }: { label: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
        active ? "font-medium text-zinc-900" : "text-zinc-400"
      }`}
      style={active ? { background: "var(--brand-soft)" } : undefined}
    >
      <GridIcon className="h-4 w-4 opacity-70" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function PoweredByVern() {
  return (
    <a
      href="https://docs.vern.so/migration-api/introduction"
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-600"
    >
      <span>Migration powered by</span>
      <span className="font-semibold text-zinc-500">Vern</span>
    </a>
  );
}
