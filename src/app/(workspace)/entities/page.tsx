import type { Metadata } from "next";
import { Network } from "lucide-react";

import { EntitiesDirectory } from "@/components/entities-directory";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";
import { demoEntities } from "@/lib/fixtures/workspace";

export const metadata: Metadata = { title: "Vendors & actors" };

export default function EntitiesPage() {
  return (
    <>
      <PageHeading
        eyebrow="Institutional memory"
        title="Vendors & actors"
        description="Canonical identities accumulate dated procurement history. Similarity is never displayed as a verified relationship without supporting evidence."
        actions={
          <PrimaryActionLink href="/graph">
            <Network size={16} strokeWidth={2.1} /> Open graph
          </PrimaryActionLink>
        }
      />

      <div className="shell-page-content">
        <EntitiesDirectory entities={demoEntities} />
      </div>
    </>
  );
}
