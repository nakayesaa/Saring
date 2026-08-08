import Link from "next/link";
import type { DemoPackage } from "@/lib/fixtures/workspace";
import { PriorityLabel } from "./priority-label";

function PackageName({ item }: { item: DemoPackage }) {
  const className = "block max-w-[360px] truncate text-base font-medium text-[#17191d]";
  return item.href ? <Link href={item.href} className={`${className} hover:underline`}>{item.name}</Link> : <span className={className}>{item.name}</span>;
}

export function PriorityPackagesTable({ packages }: { packages: readonly DemoPackage[] }) {
  return (
    <section className="mt-8" aria-labelledby="priority-packages-title">
      <div>
        <h2 id="priority-packages-title" className="text-lg font-bold text-[#0b1b43]">
          Priority packages
        </h2>
        <p className="mt-1 text-sm font-medium text-[#647493]">
          Packages ordered by review priority and evidence readiness.
        </p>
      </div>

      <p className="mt-5 text-base text-[#2d3f66]">{packages.length} results</p>

      <div className="ui-scrollbar-hidden mt-5 overflow-x-auto">
        <table className="w-full min-w-[1160px] border-collapse text-left">
          <thead>
            <tr className="bg-[#A7F3D0] text-sm font-medium text-[#17191d]">
              <th scope="col" className="w-[25%] px-5 py-3.5">Name</th>
              <th scope="col" className="px-4 py-3.5">Status</th>
              <th scope="col" className="px-4 py-3.5">Tracking ID</th>
              <th scope="col" className="px-4 py-3.5">Buyer</th>
              <th scope="col" className="px-4 py-3.5">Priority</th>
              <th scope="col" className="px-4 py-3.5">Evidence</th>
              <th scope="col" className="px-4 py-3.5">Findings</th>
              <th scope="col" className="px-4 py-3.5">Value</th>
              <th scope="col" className="px-4 py-3.5">Updated</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((item) => (
              <tr
                key={item.id}
                className="row-hover group border-b border-[#ececeb] bg-white last:border-0 hover:bg-[#fafafa]"
              >
                <td className="px-5 py-4.5">
                  <PackageName item={item} />
                </td>
                <td className="whitespace-nowrap px-4 py-4.5 text-base text-[#17191d]">
                  {item.stage}
                </td>
                <td className="whitespace-nowrap px-4 py-4.5 font-mono text-sm text-[#17191d]">
                  {item.id}
                </td>
                <td className="whitespace-nowrap px-4 py-4.5 text-base text-[#17191d]">
                  {item.buyer}
                </td>
                <td className="whitespace-nowrap px-4 py-4.5">
                  <PriorityLabel priority={item.priority} />
                </td>
                <td className="whitespace-nowrap px-4 py-4.5 text-base text-[#17191d]">
                  {item.completeness}%
                </td>
                <td className="whitespace-nowrap px-4 py-4.5 text-base text-[#17191d]">
                  {item.findings}
                </td>
                <td className="whitespace-nowrap px-4 py-4.5 text-base text-[#17191d]">
                  {item.value}
                </td>
                <td className="whitespace-nowrap px-4 py-4.5 text-base text-[#17191d]">
                  {item.updated}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
