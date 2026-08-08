export type GraphVendor = {
  id: string;
  name: string;
  x: number;
  y: number;
};

export type GraphConnection = {
  source: GraphVendor["id"];
  target: GraphVendor["id"];
  weight: 1 | 2 | 3;
};

export const graphVendors = [
  { id: "SYN-V001", name: "PT Arunika Teknologi", x: 150, y: 120 },
  { id: "SYN-V002", name: "CV Bintang Data", x: 420, y: 90 },
  { id: "SYN-V003", name: "PT Cakrawala Sistem", x: 640, y: 265 },
  { id: "SYN-V004", name: "PT Daya Komputasi", x: 900, y: 110 },
  { id: "SYN-V005", name: "CV Elang Digital", x: 1130, y: 210 },
  { id: "SYN-V006", name: "PT Fajar Integrasi", x: 185, y: 345 },
  { id: "SYN-V007", name: "PT Garuda Informatika", x: 430, y: 350 },
  { id: "SYN-V008", name: "CV Harmoni Solusi", x: 840, y: 350 },
  { id: "SYN-V009", name: "PT Inti Perangkat", x: 1090, y: 440 },
  { id: "SYN-V010", name: "PT Jelajah Teknologi", x: 150, y: 590 },
  { id: "SYN-V011", name: "CV Karya Digital", x: 390, y: 625 },
  { id: "SYN-V012", name: "PT Lintas Sistem", x: 640, y: 520 },
  { id: "SYN-V013", name: "PT Merah Putih Data", x: 875, y: 625 },
  { id: "SYN-V014", name: "CV Nusa Komputasi", x: 1130, y: 650 },
  { id: "SYN-V015", name: "PT Orbit Integrasi", x: 660, y: 720 },
] satisfies GraphVendor[];

export const graphConnections = [
  { source: "SYN-V001", target: "SYN-V002", weight: 1 },
  { source: "SYN-V001", target: "SYN-V006", weight: 2 },
  { source: "SYN-V002", target: "SYN-V003", weight: 2 },
  { source: "SYN-V002", target: "SYN-V007", weight: 1 },
  { source: "SYN-V003", target: "SYN-V004", weight: 1 },
  { source: "SYN-V003", target: "SYN-V007", weight: 3 },
  { source: "SYN-V003", target: "SYN-V008", weight: 2 },
  { source: "SYN-V003", target: "SYN-V012", weight: 2 },
  { source: "SYN-V004", target: "SYN-V005", weight: 2 },
  { source: "SYN-V004", target: "SYN-V008", weight: 1 },
  { source: "SYN-V005", target: "SYN-V009", weight: 1 },
  { source: "SYN-V006", target: "SYN-V007", weight: 2 },
  { source: "SYN-V006", target: "SYN-V010", weight: 1 },
  { source: "SYN-V007", target: "SYN-V011", weight: 1 },
  { source: "SYN-V007", target: "SYN-V012", weight: 2 },
  { source: "SYN-V008", target: "SYN-V009", weight: 2 },
  { source: "SYN-V008", target: "SYN-V012", weight: 3 },
  { source: "SYN-V009", target: "SYN-V014", weight: 1 },
  { source: "SYN-V010", target: "SYN-V011", weight: 2 },
  { source: "SYN-V011", target: "SYN-V012", weight: 1 },
  { source: "SYN-V011", target: "SYN-V015", weight: 1 },
  { source: "SYN-V012", target: "SYN-V013", weight: 2 },
  { source: "SYN-V012", target: "SYN-V015", weight: 3 },
  { source: "SYN-V013", target: "SYN-V014", weight: 1 },
  { source: "SYN-V013", target: "SYN-V015", weight: 2 },
] satisfies GraphConnection[];
