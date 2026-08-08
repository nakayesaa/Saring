import type { Metadata } from "next";

import { VendorRelationshipGraph } from "@/components/vendor-relationship-graph";

export const metadata: Metadata = {
  title: "Graph Relasi Vendor | SARING",
};

export default function GraphPage() {
  return <VendorRelationshipGraph />;
}
