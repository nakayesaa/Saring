import type { PackagePriority } from "@/lib/fixtures/workspace";
import { DotLabel, type DotTone } from "./dot-label";

const priorityTone: Record<PackagePriority, DotTone> = {
  Critical: "critical",
  High: "warning",
  Medium: "neutral",
  Reference: "info",
};

export function PriorityLabel({ priority }: { priority: PackagePriority }) {
  return <DotLabel tone={priorityTone[priority]}>{priority}</DotLabel>;
}
