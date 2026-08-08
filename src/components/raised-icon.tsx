import type { ReactNode } from "react";

const sizeClass = {
  compact: "size-9 rounded-[10px]",
  regular: "size-11 rounded-xl",
} as const;

export function RaisedIcon({
  children,
  size = "compact",
}: {
  children: ReactNode;
  size?: keyof typeof sizeClass;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center border-2 border-[#d7d9dd] bg-white text-[#17191d] shadow-[0_12px_24px_-14px_rgb(11_27_67_/_52%),0_5px_12px_-8px_rgb(20_80_230_/_24%)] ${sizeClass[size]}`}
    >
      {children}
    </span>
  );
}
