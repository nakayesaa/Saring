import { GOLDEN_PACKAGE_ID } from "@/lib/demo-ids";

export type ReviewPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EngineKey = "price" | "document" | "graph";

export type EvidenceCitation = {
  label: string;
  source: string;
  locator: string;
  excerpt: string;
};

export type GoldenFinding = {
  id: string;
  module: "PRICE" | "DOCUMENT" | "GRAPH" | "DATA_QUALITY";
  title: string;
  summary: string;
  severity: ReviewPriority;
  confidence: number;
  status: "OPEN" | "ABSTAINED";
  metric: string;
  alternativeExplanation: string;
  citations: EvidenceCitation[];
};

export type EngineRun = {
  key: EngineKey;
  label: string;
  status: "COMPLETED" | "PARTIAL" | "ABSTAINED";
  progress: number;
  findingCount: number;
  duration: string;
  modelVersion: string;
  summary: string;
};

export type GoldenVendor = {
  id: string;
  name: string;
  bidTotal: number;
  unitPrice: number;
  pricePosition: "BELOW_Q50" | "EXPECTED" | "ABOVE_Q90";
  technicalStatus: "PASS" | "REVIEW";
  documentStatus: "COMPLETE" | "REVIEW";
  historicalTenders: number;
  historicalWins: number;
};

export type GoldenCase = {
  id: string;
  name: string;
  buyer: string;
  buyerUnit: string;
  method: string;
  category: string;
  fiscalYear: number;
  analysisCutoffAt: string;
  announcedValue: number;
  hpsTotal: number;
  participantCount: number;
  fileCount: number;
  evidenceCompleteness: number;
  priority: ReviewPriority;
  reviewScore: number;
  synthetic: true;
  workflowStage: "READY_FOR_REVIEW";
  engines: EngineRun[];
  findings: GoldenFinding[];
  vendors: GoldenVendor[];
};

const vendors: GoldenVendor[] = [
  ["SYN-V001", "PT Arunika Komputasi Nusantara", 37_050_000_000, 12_350_000, "EXPECTED", "PASS", "COMPLETE", 38, 7],
  ["SYN-V002", "PT Bintang Sistem Digital", 36_540_000_000, 12_180_000, "EXPECTED", "PASS", "COMPLETE", 24, 4],
  ["SYN-V003", "PT Cakrawala Piranti Indonesia", 43_500_000_000, 14_500_000, "ABOVE_Q90", "PASS", "COMPLETE", 31, 9],
  ["SYN-V004", "PT Daya Komputindo Utama", 35_760_000_000, 11_920_000, "EXPECTED", "PASS", "COMPLETE", 19, 3],
  ["SYN-V005", "PT Elang Teknologi Mandiri", 34_950_000_000, 11_650_000, "EXPECTED", "PASS", "COMPLETE", 16, 2],
  ["SYN-V006", "PT Fajar Perangkat Negeri", 36_900_000_000, 12_300_000, "EXPECTED", "REVIEW", "REVIEW", 28, 5],
  ["SYN-V007", "PT Garuda Data Solusi", 36_840_000_000, 12_280_000, "EXPECTED", "REVIEW", "REVIEW", 27, 4],
  ["SYN-V008", "PT Harmoni Komputer Indonesia", 34_500_000_000, 11_500_000, "BELOW_Q50", "PASS", "COMPLETE", 12, 1],
  ["SYN-V009", "PT Inti Digital Persada", 37_440_000_000, 12_480_000, "EXPECTED", "PASS", "COMPLETE", 22, 3],
  ["SYN-V010", "CV Jelajah Teknologi", 35_100_000_000, 11_700_000, "EXPECTED", "PASS", "COMPLETE", 9, 1],
  ["SYN-V011", "PT Karya Notebook Nasional", 38_100_000_000, 12_700_000, "ABOVE_Q90", "PASS", "COMPLETE", 33, 8],
  ["SYN-V012", "PT Lintas Perangkat Nusantara", 35_820_000_000, 11_940_000, "EXPECTED", "PASS", "COMPLETE", 17, 2],
  ["SYN-V013", "PT Merah Putih Komputasi", 36_150_000_000, 12_050_000, "EXPECTED", "PASS", "COMPLETE", 21, 3],
  ["SYN-V014", "PT Nusa Data Teknologi", 34_860_000_000, 11_620_000, "EXPECTED", "PASS", "REVIEW", 14, 2],
  ["SYN-V015", "PT Orbit Sistem Indonesia", 37_200_000_000, 12_400_000, "EXPECTED", "PASS", "COMPLETE", 25, 4],
].map(([id, name, bidTotal, unitPrice, pricePosition, technicalStatus, documentStatus, historicalTenders, historicalWins]) => ({
  id: id as string,
  name: name as string,
  bidTotal: bidTotal as number,
  unitPrice: unitPrice as number,
  pricePosition: pricePosition as GoldenVendor["pricePosition"],
  technicalStatus: technicalStatus as GoldenVendor["technicalStatus"],
  documentStatus: documentStatus as GoldenVendor["documentStatus"],
  historicalTenders: historicalTenders as number,
  historicalWins: historicalWins as number,
}));

export const goldenCase: GoldenCase = {
  id: GOLDEN_PACKAGE_ID,
  name: "Pengadaan Laptop Bisnis Nasional",
  buyer: "Unit Pengadaan Alpha",
  buyerUnit: "Direktorat Infrastruktur Digital",
  method: "Tender cepat",
  category: "Laptop bisnis",
  fiscalYear: 2025,
  analysisCutoffAt: "19 September 2025, 18.00 WIB",
  announcedValue: 42_800_000_000,
  hpsTotal: 39_600_000_000,
  participantCount: 15,
  fileCount: 98,
  evidenceCompleteness: 96,
  priority: "CRITICAL",
  reviewScore: 86,
  synthetic: true,
  workflowStage: "READY_FOR_REVIEW",
  engines: [
    {
      key: "price",
      label: "Price intelligence",
      status: "COMPLETED",
      progress: 100,
      findingCount: 3,
      duration: "21 detik",
      modelVersion: "price-qreg-demo-1.0",
      summary: "15 penawaran dibandingkan dengan rentang harga bersyarat Q10/Q50/Q90.",
    },
    {
      key: "document",
      label: "Document intelligence",
      status: "COMPLETED",
      progress: 100,
      findingCount: 2,
      duration: "44 detik",
      modelVersion: "document-evidence-demo-1.0",
      summary: "98 record dokumen direkonsiliasi; template wajib dikeluarkan dari similarity analysis.",
    },
    {
      key: "graph",
      label: "Relationship intelligence",
      status: "COMPLETED",
      progress: 100,
      findingCount: 1,
      duration: "12 detik",
      modelVersion: "graph-motif-demo-1.0",
      summary: "15 peserta dibandingkan dengan riwayat partisipasi dan award sebelum cutoff.",
    },
  ],
  findings: [
    {
      id: "FND-PRICE-001",
      module: "PRICE",
      title: "Penawaran unit Vendor 03 berada di atas Q90",
      summary: "Harga Rp14,50 juta per unit melampaui batas atas bersyarat Rp12,60 juta untuk spesifikasi yang sebanding.",
      severity: "HIGH",
      confidence: 0.87,
      status: "OPEN",
      metric: "+15,1% di atas Q90 · exposure Rp5,70 miliar",
      alternativeExplanation: "Komponen layanan, garansi, atau konfigurasi tambahan perlu dikonfirmasi sebelum eskalasi.",
      citations: [
        { label: "Commercial offer", source: "commercial_offer_SYN-V003.pdf", locator: "halaman 4 · tabel harga", excerpt: "Harga satuan termasuk konfigurasi dan pengiriman: Rp14.500.000" },
        { label: "Price interval", source: "price-qreg-demo-1.0", locator: "item LAPTOP-BISNIS-16-512", excerpt: "Q50 Rp11.200.000 · Q90 Rp12.600.000" },
      ],
    },
    {
      id: "FND-PRICE-002",
      module: "PRICE",
      title: "HPS berada di atas median historis bersyarat",
      summary: "HPS unit Rp13,20 juta lebih tinggi daripada median model Rp11,20 juta setelah quantity dan spesifikasi dinormalisasi.",
      severity: "MEDIUM",
      confidence: 0.78,
      status: "OPEN",
      metric: "+17,9% terhadap Q50",
      alternativeExplanation: "HPS dapat memuat pajak, pengiriman, atau dukungan yang tidak tercakup penuh dalam comparator.",
      citations: [{ label: "HPS item", source: "hps_items.csv", locator: "baris 1", excerpt: "3.000 unit · Rp13.200.000 per unit" }],
    },
    {
      id: "FND-PRICE-003",
      module: "PRICE",
      title: "Dua penawaran membutuhkan comparability review",
      summary: "Perbedaan warranty dan service component membuat perbandingan harga Vendor 11 dan Vendor 15 belum sepenuhnya setara.",
      severity: "MEDIUM",
      confidence: 0.69,
      status: "OPEN",
      metric: "2 dari 15 penawaran",
      alternativeExplanation: "Harga lebih tinggi dapat dijelaskan oleh coverage layanan yang lebih panjang.",
      citations: [{ label: "Technical normalization", source: "canonical_bid_items.json", locator: "SYN-V011, SYN-V015", excerpt: "Warranty coverage berbeda 12 bulan" }],
    },
    {
      id: "FND-DOC-001",
      module: "DOCUMENT",
      title: "Passage non-template Vendor 06 dan 07 sangat mirip",
      summary: "Metode implementasi berbagi urutan kalimat dan typo langka setelah klausul resmi serta bahasa produsen dikeluarkan.",
      severity: "HIGH",
      confidence: 0.82,
      status: "OPEN",
      metric: "Similarity 0,91 · 1 rare shared typo",
      alternativeExplanation: "Kedua vendor dapat memakai konsultan atau materi teknis pihak ketiga yang sama.",
      citations: [
        { label: "Vendor 06", source: "technical_offer_SYN-V006.pdf", locator: "halaman 11 · metode implementasi", excerpt: "Distribusi menggunakan staging dua tahap dan kontrol mutu pada setipa unit..." },
        { label: "Vendor 07", source: "technical_offer_SYN-V007.pdf", locator: "halaman 9 · metode implementasi", excerpt: "Distribusi menggunakan staging dua tahap dan kontrol mutu pada setipa unit..." },
      ],
    },
    {
      id: "FND-DOC-002",
      module: "DOCUMENT",
      title: "Satu dokumen membutuhkan verifikasi ekstraksi",
      summary: "Technical offer Vendor 14 mempunyai confidence rendah pada bagian garansi sehingga pemeriksaan compliance diabstain.",
      severity: "MEDIUM",
      confidence: 0.46,
      status: "ABSTAINED",
      metric: "Extraction confidence 46%",
      alternativeExplanation: "Nilai garansi dapat diverifikasi langsung dari sumber canonical atau dikonfirmasi kepada vendor.",
      citations: [{ label: "Low-confidence field", source: "technical_offer_SYN-V014", locator: "warranty_months", excerpt: "Nilai belum dapat diverifikasi secara andal" }],
    },
    {
      id: "FND-GRAPH-001",
      module: "GRAPH",
      title: "Kelompok tiga vendor berulang kali melakukan co-bidding",
      summary: "Vendor 03, 06, dan 07 muncul bersama pada 11 tender historis; dua award terakhir berotasi di dalam kelompok tersebut.",
      severity: "HIGH",
      confidence: 0.74,
      status: "OPEN",
      metric: "11 co-bids · 2 award rotations",
      alternativeExplanation: "Vendor dapat beroperasi pada pasar dan wilayah yang sama tanpa koordinasi langsung.",
      citations: [{ label: "Historical graph path", source: "historical_participation.csv", locator: "11 dated package edges", excerpt: "Semua edge terjadi sebelum analysis cutoff" }],
    },
  ],
  vendors,
};

export function getGoldenCase(packageId: string) {
  return packageId === goldenCase.id ? goldenCase : null;
}

export function formatIdr(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
