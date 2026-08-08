"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileStack,
  FolderKanban,
  LayoutDashboard,
  Network,
  ScanSearch,
  UsersRound,
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "Review queue", icon: LayoutDashboard },
  { href: "/packages", label: "Packages", icon: FolderKanban },
  { href: "/documents", label: "Documents", icon: FileStack },
  { href: "/entities", label: "Vendors & actors", icon: UsersRound },
  { href: "/graph", label: "Relationship graph", icon: Network },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`product-nav-link ${active ? "active" : ""}`}
          >
            <Icon aria-hidden="true" size={15} strokeWidth={1.7} />
            <span>{label}</span>
          </Link>
        );
      })}

      <div className="product-nav-divider" />
      <div className="product-nav-link product-nav-disabled" aria-disabled="true">
        <ScanSearch aria-hidden="true" size={15} strokeWidth={1.7} />
        <span>Analysis engines</span>
        <small>Soon</small>
      </div>
    </nav>
  );
}
