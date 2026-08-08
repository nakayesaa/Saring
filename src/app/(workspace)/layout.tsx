import { AppShell } from "@/components/app-shell";
import { requireWorkspaceSession } from "@/lib/auth/session";
import type { ReactNode } from "react";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireWorkspaceSession();
  return <AppShell session={session}>{children}</AppShell>;
}
