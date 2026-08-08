import type { ReactNode } from "react";

export type DotTone = "critical" | "warning" | "neutral" | "info" | "success" | "restricted";

const toneClass: Record<DotTone, string> = {
  critical: "bg-[#d64a3f]",
  warning: "bg-[#c47a00]",
  neutral: "bg-[#77869f]",
  info: "bg-[#1450e6]",
  success: "bg-[#2f8f5b]",
  restricted: "bg-[#8b5fbf]",
};

export function DotLabel({ children, tone }: { children: ReactNode; tone: DotTone }) {
  return (
    <span className="inline-flex items-center gap-2 text-base text-[#2d3f66]">
      <span className={`size-2 shrink-0 rounded-full ${toneClass[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}
