"use client";

import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  CircleUserRound,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import type { WorkspaceSession } from "@/lib/auth/session";
import { SidebarNav } from "./sidebar-nav";
import { SaringMark } from "./saring-mark";
import { GuidedDemoTour } from "./guided-demo-tour";

const compactShellQuery = "(max-width: 940px)";

function subscribeToCompactShell(onChange: () => void) {
  const media = window.matchMedia(compactShellQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getCompactShellSnapshot() {
  return window.matchMedia(compactShellQuery).matches;
}

function getCompactShellServerSnapshot() {
  return false;
}

export function AppShell({ session, children }: { session: WorkspaceSession; children: ReactNode }) {
  const compactShell = useSyncExternalStore(
    subscribeToCompactShell,
    getCompactShellSnapshot,
    getCompactShellServerSnapshot,
  );
  const [sidebarPreference, setSidebarPreference] = useState<boolean | null>(null);
  const sidebarOpen = sidebarPreference ?? !compactShell;

  return (
    <div className={`product-shell ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      <aside
        className="product-sidebar"
        aria-hidden={!sidebarOpen && compactShell}
        inert={!sidebarOpen && compactShell ? true : undefined}
      >
        <div className="product-brand-row">
          {sidebarOpen ? (
            <>
              <Link className="product-brand" href="/dashboard" aria-label="SARING home">
                <span className="product-brand-mark" aria-hidden="true"><SaringMark /></span>
                <span className="product-brand-name">SARING</span>
              </Link>

              <button
                className="product-icon-button product-sidebar-close"
                type="button"
                onClick={() => setSidebarPreference(false)}
                aria-label="Ciutkan sidebar"
              >
                <PanelLeftClose size={21} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              className="product-icon-button product-sidebar-rail-toggle"
              type="button"
              onClick={() => setSidebarPreference(true)}
              aria-label="Perluas sidebar"
            >
              <PanelLeftOpen size={21} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="product-sidebar-scroll">
          <section className="product-nav-section">
            <div className="product-nav-label">Workspace</div>
            <SidebarNav />
          </section>
        </div>

        <div className="product-sidebar-footer">
          <form action={signOut}>
            <button className="product-profile" type="submit" aria-label={`Keluar dari akun ${session.displayName}`}>
              <span className="product-avatar" aria-hidden="true">
                <CircleUserRound size={24} strokeWidth={1.8} />
              </span>
              <span className="product-profile-copy">
                <strong>{session.displayName}</strong>
                <small>{session.mode === "local-demo" ? "Reviewer · Demo data" : "Reviewer · Protected"}</small>
              </span>
              <LogOut size={14} aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>

      <main className="product-workspace">
        {!sidebarOpen ? (
          <button
            className="product-icon-button product-sidebar-open"
            type="button"
            onClick={() => setSidebarPreference(true)}
            aria-label="Buka sidebar"
          >
            <PanelLeftOpen size={17} aria-hidden="true" />
          </button>
        ) : null}
        <section className="shell-page fade-in">{children}</section>
      </main>
      <GuidedDemoTour />
    </div>
  );
}
