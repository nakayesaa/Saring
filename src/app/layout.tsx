import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SARING",
    template: "%s · SARING",
  },
  description: "Evidence intelligence workspace for procurement review.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

// A nonce-based CSP requires request-time rendering so Next can attach the
// per-request nonce to framework scripts.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
