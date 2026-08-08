import { GOLDEN_PACKAGE_ID } from "@/lib/demo-ids";

export type PackagePriority = "Critical" | "High" | "Medium" | "Reference";

export type DemoPackage = {
  id: string;
  name: string;
  buyer: string;
  method: string;
  value: string;
  priority: PackagePriority;
  findings: number;
  completeness: number;
  stage: "In review" | "Ready" | "Needs evidence" | "Anchor only";
  updated: string;
  synthetic: boolean;
  href: string | null;
};

export const demoPackages: DemoPackage[] = [
  {
    id: GOLDEN_PACKAGE_ID,
    name: "Pengadaan Laptop Bisnis Nasional",
    buyer: "Unit Pengadaan Alpha",
    method: "Tender cepat",
    value: "Rp42,8 M",
    priority: "Critical",
    findings: 6,
    completeness: 96,
    stage: "In review",
    updated: "4 min ago",
    synthetic: true,
    href: `/packages/${GOLDEN_PACKAGE_ID}/findings`,
  },
  {
    id: "SYN-LAPTOP-REG-004",
    name: "Perangkat Kerja Regional Barat",
    buyer: "Sekretariat Beta",
    method: "Tender",
    value: "Rp18,2 M",
    priority: "High",
    findings: 4,
    completeness: 88,
    stage: "Ready",
    updated: "18 min ago",
    synthetic: true,
    href: null,
  },
  {
    id: "SYN-ENDPOINT-009",
    name: "Modernisasi Endpoint Kantor",
    buyer: "Direktorat Gamma",
    method: "E-purchasing",
    value: "Rp9,7 M",
    priority: "Medium",
    findings: 2,
    completeness: 79,
    stage: "Needs evidence",
    updated: "1 hr ago",
    synthetic: true,
    href: null,
  },
  {
    id: "LKPP-ANCHOR-2024",
    name: "Konsolidasi Laptop Dalam Negeri 2024",
    buyer: "LKPP",
    method: "Konsolidasi nasional",
    value: "Reference",
    priority: "Reference",
    findings: 0,
    completeness: 72,
    stage: "Anchor only",
    updated: "2 days ago",
    synthetic: false,
    href: null,
  },
];

export type DemoDocument = {
  name: string;
  type: string;
  packageId: string;
  pages: string;
  extraction: "Validated" | "Verified" | "Parsed" | "OCR review" | "Queued";
  classification: "Synthetic" | "Restricted";
  updated: string;
};

export const demoDocuments: DemoDocument[] = [
  { name: "manifest.json", type: "Manifest", packageId: GOLDEN_PACKAGE_ID, pages: "—", extraction: "Validated", classification: "Synthetic", updated: "4 min ago" },
  { name: "01_KAK_dan_spesifikasi.pdf", type: "Requirement", packageId: GOLDEN_PACKAGE_ID, pages: "18", extraction: "Parsed", classification: "Synthetic", updated: "6 min ago" },
  { name: "02_HPS_laptop_bisnis.pdf", type: "HPS", packageId: GOLDEN_PACKAGE_ID, pages: "7", extraction: "Verified", classification: "Synthetic", updated: "7 min ago" },
  { name: "vendor_03_penawaran_teknis.pdf", type: "Technical bid", packageId: GOLDEN_PACKAGE_ID, pages: "24", extraction: "Parsed", classification: "Restricted", updated: "8 min ago" },
  { name: "vendor_03_penawaran_harga.pdf", type: "Commercial bid", packageId: GOLDEN_PACKAGE_ID, pages: "9", extraction: "Verified", classification: "Restricted", updated: "8 min ago" },
  { name: "vendor_08_scan_administrasi.pdf", type: "Administrative bid", packageId: GOLDEN_PACKAGE_ID, pages: "12", extraction: "OCR review", classification: "Restricted", updated: "11 min ago" },
  { name: "evaluasi_ringkas.pdf", type: "Evaluation", packageId: GOLDEN_PACKAGE_ID, pages: "11", extraction: "Parsed", classification: "Synthetic", updated: "13 min ago" },
  { name: "berita_acara_negosiasi.pdf", type: "Negotiation", packageId: GOLDEN_PACKAGE_ID, pages: "6", extraction: "Queued", classification: "Synthetic", updated: "14 min ago" },
];

export type DemoEntity = {
  name: string;
  kind: "Vendor" | "Buyer";
  tenders: number;
  wins: number;
  links: number;
  verification: "Verified" | "Source matched";
  lastSeen: string;
};

export const demoEntities: DemoEntity[] = [
  { name: "PT Arunika Teknologi", kind: "Vendor", tenders: 14, wins: 3, links: 7, verification: "Verified", lastSeen: "Today" },
  { name: "PT Nusa Digital Persada", kind: "Vendor", tenders: 11, wins: 2, links: 5, verification: "Verified", lastSeen: "Today" },
  { name: "CV Sumber Mitra Komputasi", kind: "Vendor", tenders: 8, wins: 1, links: 4, verification: "Source matched", lastSeen: "2 days ago" },
  { name: "PT Tera Bina Sistem", kind: "Vendor", tenders: 6, wins: 0, links: 3, verification: "Source matched", lastSeen: "4 days ago" },
  { name: "Unit Pengadaan Alpha", kind: "Buyer", tenders: 22, wins: 0, links: 15, verification: "Verified", lastSeen: "Today" },
];

export const dashboardMetrics = [
  { label: "Packages monitored", value: "4", delta: "+1 this week", icon: "packages" },
  { label: "Needs review", value: "2", delta: "1 critical", icon: "review" },
  { label: "Evidence coverage", value: "89%", delta: "+7.4%", icon: "evidence" },
  { label: "Median review time", value: "18m", delta: "−6 min", icon: "time" },
] as const;

export const dashboardEngineSignals = [
  { title: "Price engine", detail: "3 explainable signals", score: 86 },
  { title: "Document engine", detail: "2 page-pair matches", score: 74 },
  { title: "Graph engine", detail: "1 dated pattern", score: 61 },
] as const;

export const documentMetrics = [
  { label: "Total files", value: "144", detail: "Complete hybrid case", icon: "files" },
  { label: "Validated", value: "144", detail: "Hash + manifest", icon: "validated" },
  { label: "Native text", value: "77", detail: "PDF extraction", icon: "validated" },
  { label: "OCR fallback", value: "1", detail: "Reviewer check", icon: "ocr" },
] as const;

export const packageSummaryMetrics = [
  { title: "Active reviews", detail: "Human dispositions pending", value: "2", icon: "active" },
  { title: "Archived packages", detail: "Read-only institutional memory", value: "0", icon: "archived" },
  { title: "Package contract", detail: "Manifest compliance", value: "100%", icon: "contract" },
] as const;
