import type { SVGProps } from "react";

export function SaringMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="SARING evidence sieve"
      {...props}
    >
      <path
        d="M4 6.5h24M7.5 12.5h17M11 18.5h10M16 18.5v5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="26.5" r="2.7" fill="#c7ff00" />
    </svg>
  );
}
