import type { Metadata } from "next";
import { CanonicalPackageImport } from "@/components/canonical-package-import";
import { PageHeading } from "@/components/page-heading";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { listStoredPackages } from "@/lib/intake/library";

export const metadata: Metadata = { title: "Import canonical package" };

export default async function NewPackagePage() {
  const principal = await resolveWorkspacePrincipal(await requireWorkspaceSession());
  const storedPackages = await listStoredPackages(principal);
  return (
    <>
      <PageHeading
        eyebrow="Package intake"
        title="Import procurement package"
        description="Create a review workspace from one immutable procurement snapshot. Before analysis, SARING verifies manifest integrity, evidence provenance, and the pre-award cutoff."
      />
      <div className="shell-page-content">
        <CanonicalPackageImport bundles={storedPackages} />
      </div>
    </>
  );
}
