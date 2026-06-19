import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embedded migration — live demo",
  description: "See how an embedded Vern migration agent would feel inside your product.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
