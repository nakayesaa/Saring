"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";

export function PrimaryActionLink({
  href,
  children,
  className = "",
  pendingLabel = "Opening…",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const [pending, setPending] = useState(false);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    const opensInCurrentTab = event.button === 0 &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (opensInCurrentTab) {
      setPending(true);
    }
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-busy={pending}
      className={`pending-action inline-flex h-12 shrink-0 items-center justify-center rounded-lg border border-[#a9d500] bg-[#c7ff00] px-5 text-base font-extrabold text-[#0b1b43] shadow-[0_5px_12px_-7px_rgb(11_27_67_/_55%)] transition hover:bg-[#b9ee00] ${className}`}
    >
      <span className="pending-action-content grid items-center">
        <span
          aria-hidden={pending}
          className={`[grid-area:1/1] inline-flex items-center justify-center gap-2 transition-opacity duration-150 ${pending ? "opacity-0" : "opacity-100"}`}
        >
          {children}
        </span>
        <span
          aria-hidden={!pending}
          className={`[grid-area:1/1] transition-opacity duration-150 ${pending ? "opacity-100" : "opacity-0"}`}
        >
          {pendingLabel}
        </span>
      </span>
    </Link>
  );
}
