"use client";

import { useRef, useState } from "react";
import { LocateFixed, Minus, Plus, X } from "lucide-react";

import {
  graphConnections,
  graphVendors,
  type GraphVendor,
} from "@/lib/relationship-graph-fixture";

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 800;
const MIN_SCALE = 0.55;
const MAX_SCALE = 1.45;
const DEFAULT_SCALE = 0.82;

type Point = { x: number; y: number };

const vendorById = new Map(graphVendors.map((vendor) => [vendor.id, vendor]));
const vendorDetailPlaceholders = [
  ["Ringkasan vendor", "Ini harusnya ringkasan profil vendor."],
  ["Riwayat partisipasi", "Ini isinya riwayat partisipasi vendor."],
  ["Hubungan terverifikasi", "Ini harusnya daftar hubungan yang punya sumber."],
  ["Sumber bukti", "Ini isinya source locator dan tanggal bukti."],
] as const;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function VendorNode({
  vendor,
  selected,
  onSelect,
}: {
  vendor: GraphVendor;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerDown={(event) => event.stopPropagation()}
      className={`pointer-events-auto group absolute grid size-[116px] -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full border p-4 text-center shadow-[0_12px_28px_-18px_rgb(11_27_67_/_45%)] transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-[54%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1450e6] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
        selected
          ? "border-2 border-[#1450e6] bg-[#eef3ff] shadow-[0_16px_34px_-18px_rgb(20_80_230_/_42%)]"
          : "border-[#aeb4c0] bg-white hover:border-[#647493] hover:bg-[#fafafa]"
      }`}
      style={{ left: vendor.x, top: vendor.y }}
      aria-pressed={selected}
      aria-label={`Buka detail ${vendor.name}`}
    >
      <span className="block w-[78px] min-w-0 overflow-hidden">
        <span className="line-clamp-2 block text-xs font-semibold leading-[1.2] tracking-[-0.01em] text-[#0b1b43]">
          {vendor.name.replace(/^(PT|CV)\s+/, "")}
        </span>
        <span className="mt-1 block truncate text-xs font-medium leading-none tracking-[0.02em] text-[#7b879f]">
          {vendor.id}
        </span>
      </span>
    </button>
  );
}

function VendorDrawer({ vendor, onClose }: { vendor: GraphVendor | null; onClose: () => void }) {
  return (
    <aside
      className={`absolute inset-y-0 right-0 z-30 flex w-[min(92vw,390px)] flex-col border-l-2 border-[#8f9aad] bg-white shadow-[-24px_0_56px_-34px_rgb(11_27_67_/_55%)] transition-[transform,opacity] duration-300 ease-out xl:relative xl:w-auto xl:min-w-0 ${
        vendor
          ? "visible translate-x-0 opacity-100"
          : "invisible pointer-events-none translate-x-full opacity-0"
      }`}
      aria-hidden={!vendor}
      inert={!vendor}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#d7d9dd] px-6 py-6">
        <div className="min-w-0">
          <p className="text-[20px] font-semibold uppercase tracking-[0.12em] text-[#647493]">
            Detail vendor
          </p>
          <h2 className="mt-2 truncate text-[18px] font-semibold tracking-[-0.025em] text-[#0b1b43]">
            {vendor?.name ?? "Vendor"}
          </h2>
          <p className="mt-1 text-[20px] text-[#7b879f]">{vendor?.id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#d7d9dd] text-[#647493] transition-colors hover:border-[#aeb4c0] hover:bg-[#f5f5f4] hover:text-[#0b1b43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1450e6]"
          aria-label="Tutup detail vendor"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-2">
        {vendorDetailPlaceholders.map(([title, description]) => (
          <section key={title} className="border-b border-[#e5e6e8] py-5 last:border-b-0">
            <h3 className="text-[20px] font-semibold text-[#0b1b43]">{title}</h3>
            <p className="mt-2 text-[22px] leading-6 text-[#647493]">{description}</p>
          </section>
        ))}
      </div>
    </aside>
  );
}

export function VendorRelationshipGraph() {
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ pointer: Point; pan: Point } | null>(null);

  const selectedVendor = selectedVendorId ? vendorById.get(selectedVendorId) ?? null : null;

  function resetView() {
    setScale(DEFAULT_SCALE);
    setPan({ x: 0, y: 0 });
  }

  function zoomBy(delta: number) {
    setScale((current) => clampScale(current + delta));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointer: { x: event.clientX, y: event.clientY },
      pan,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    setPan({
      x: dragStart.current.pan.x + event.clientX - dragStart.current.pointer.x,
      y: dragStart.current.pan.y + event.clientY - dragStart.current.pointer.y,
    });
  }

  function stopDragging(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStart.current = null;
    setDragging(false);
  }

  return (
    <main className="shell-page-content">
      <section
        className={`relative grid h-[calc(100dvh-132px)] min-h-[620px] overflow-hidden rounded-2xl border-2 border-[#9fa6b2] bg-white shadow-[0_24px_52px_-28px_rgb(11_27_67_/_48%)] transition-[grid-template-columns] duration-300 ease-out ${
          selectedVendor
            ? "xl:grid-cols-[minmax(0,1fr)_390px]"
            : "xl:grid-cols-[minmax(0,1fr)_0px]"
        }`}
        aria-label="Peta relasi vendor"
      >
        <div
          className={`relative min-w-0 overflow-hidden text-[#647493] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            backgroundImage:
              "radial-gradient(circle at center, color-mix(in srgb, currentColor 24%, transparent) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onWheel={(event) => {
            event.preventDefault();
            setScale((current) => clampScale(current - event.deltaY * 0.001));
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-6 bg-gradient-to-b from-white via-white/92 to-transparent px-7 pb-16 pt-6">
            <div>
              <p className="text-[22px] font-semibold uppercase tracking-[0.08em] text-[#1450e6]">
                Relationship graph
              </p>
              <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.035em] text-[#0b1b43]">
                Jaringan partisipasi vendor
              </h1>
              <p className="mt-1.5 text-[20px] text-[#647493]">
                Geser peta, perbesar, atau pilih vendor untuk membuka detail.
              </p>
            </div>
            <div className="rounded-full border border-[#c8cbd1] bg-white/90 px-3 py-1.5 text-[20px] font-medium text-[#526383] shadow-[0_8px_20px_-16px_rgb(11_27_67_/_45%)] backdrop-blur-md">
              {graphVendors.length} vendor · {graphConnections.length} koneksi
            </div>
          </div>

          <div
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{
              width: WORLD_WIDTH,
              height: WORLD_HEIGHT,
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
            }}
          >
            <div
              className="relative size-full transition-transform duration-150 ease-out"
              style={{ transform: `scale(${scale})` }}
            >
              <svg
                className="absolute inset-0 size-full overflow-visible"
                viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
                aria-hidden="true"
              >
                {graphConnections.map((connection) => {
                  const source = vendorById.get(connection.source);
                  const target = vendorById.get(connection.target);
                  if (!source || !target) return null;

                  const active =
                    selectedVendorId === connection.source || selectedVendorId === connection.target;

                  return (
                    <line
                      key={`${connection.source}-${connection.target}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={active ? "#1450e6" : "#c8cdd6"}
                      strokeWidth={active ? 2.2 : connection.weight * 0.55 + 0.45}
                      className="transition-[stroke,stroke-width] duration-200"
                    />
                  );
                })}
              </svg>

              {graphVendors.map((vendor) => (
                <VendorNode
                  key={vendor.id}
                  vendor={vendor}
                  selected={selectedVendorId === vendor.id}
                  onSelect={() => setSelectedVendorId(vendor.id)}
                />
              ))}
            </div>
          </div>

          <div className="absolute left-5 top-[148px] z-20 flex flex-col overflow-hidden rounded-xl border border-[#c8cbd1] bg-white/95 p-1 shadow-[0_12px_30px_-18px_rgb(11_27_67_/_48%)] backdrop-blur-md">
            <button
              type="button"
              onClick={() => zoomBy(0.12)}
              className="grid size-9 place-items-center rounded-lg text-[#526383] transition-colors hover:bg-[#f3f6ff] hover:text-[#1450e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1450e6]"
              aria-label="Perbesar graph"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(-0.12)}
              className="grid size-9 place-items-center rounded-lg text-[#526383] transition-colors hover:bg-[#f3f6ff] hover:text-[#1450e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1450e6]"
              aria-label="Perkecil graph"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <div className="mx-1 h-px bg-[#d7d9dd]" aria-hidden="true" />
            <button
              type="button"
              onClick={resetView}
              className="grid size-9 place-items-center rounded-lg text-[#526383] transition-colors hover:bg-[#f3f6ff] hover:text-[#1450e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1450e6]"
              aria-label="Atur ulang posisi graph"
            >
              <LocateFixed className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <VendorDrawer vendor={selectedVendor} onClose={() => setSelectedVendorId(null)} />
      </section>
    </main>
  );
}
