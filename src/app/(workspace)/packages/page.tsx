import type { Metadata } from "next";
import { FolderPlus } from "lucide-react";
import { ActualPackagesDirectory } from "@/components/actual-packages-directory";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { listStoredPackages } from "@/lib/intake/library";

export const metadata: Metadata = { title: "Packages" };

export default async function PackagesPage() {
  const principal = await resolveWorkspacePrincipal(await requireWorkspaceSession());
  const packages = await listStoredPackages(principal);
  return <><PageHeading eyebrow="Case management" title="Packages" description="Package yang tersimpan pada database workspace aktif." actions={<PrimaryActionLink href="/packages/new"><FolderPlus size={17} /> Add package</PrimaryActionLink>} /><div className="shell-page-content"><ActualPackagesDirectory packages={packages} /></div></>;
}
