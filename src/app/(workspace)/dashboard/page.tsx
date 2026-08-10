import type { Metadata } from "next";
import { ActualPackagesDirectory } from "@/components/actual-packages-directory";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { listStoredPackages } from "@/lib/intake/library";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Review queue" };

export default async function DashboardPage() {
  const principal = await resolveWorkspacePrincipal(await requireWorkspaceSession());
  const packages = await listStoredPackages(principal);
  return <><PageHeading eyebrow="Operations" title="Review queue" description="Daftar aktual dari database workspace. Buka package untuk melihat analysis run dan temuan terbarunya." actions={<PrimaryActionLink href="/packages/new">Start review</PrimaryActionLink>} /><div className="shell-page-content"><ActualPackagesDirectory packages={packages} canDelete={hasPermission(principal.role, "package:delete")} /></div></>;
}
