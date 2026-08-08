"use client";

import { useState } from "react";
import { Filter, Search } from "lucide-react";

export type WorkspaceOption<T extends string> = { label: string; value: T };

export function WorkspaceTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly WorkspaceOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#23252a] bg-[#0b0c0d] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`h-7 rounded-md px-2.5 text-base font-medium transition ${value === option.value ? "bg-[#18191a] text-[#e2e4e7]" : "text-[#656a73] hover:text-[#a9aeb7]"}`}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function WorkspaceFilterMenu<T extends string>({
  label,
  options,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  options: readonly WorkspaceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== options[0]?.value;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${compact ? "grid size-8 place-items-center" : "flex h-8 items-center gap-1.5 px-2.5"} rounded-md border bg-[#0f1011] text-base transition ${active ? "border-[#1450e6] text-[#1450e6]" : "border-[#292b30] text-[#777c85] hover:text-[#c7cad0]"}`}
        aria-label={compact ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Filter size={12} aria-hidden="true" />
        {compact ? null : label}
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-30 w-48 rounded-lg border border-[#c8cbd1] bg-white p-1.5 shadow-[0_18px_38px_-22px_rgb(11_27_67_/_55%)]" role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full rounded-md px-3 py-2 text-left text-sm transition ${value === option.value ? "bg-[#eef3ff] text-[#1450e6]" : "text-[#526383] hover:bg-[#f5f5f4]"}`}
              role="menuitemradio"
              aria-checked={value === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceSearch({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[#292b30] bg-[#0f1011] px-2.5 text-[#62666d] sm:flex-none">
      <Search size={12} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-base text-[#c7cad0] outline-none placeholder:text-[#555a63] sm:w-40"
      />
    </label>
  );
}
