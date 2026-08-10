"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Clapperboard, X } from "lucide-react";
import { HIGH_SIGNAL_DEMO_PACKAGE_ID } from "@/lib/demo-ids";

const storageKey = "saring-guided-demo-v1";

type DemoStep = {
  title: string;
  time: string;
  route: string;
  body: string;
  cue: string;
  intro?: boolean;
  selector?: string;
};

const steps: readonly DemoStep[] = [
  {
    title: "Masalah bisnis",
    time: "00:00–00:35",
    route: "/dashboard",
    intro: true,
    body: "Dalam pengadaan, sinyal harga, kemiripan dokumen, dan hubungan antarvendor tersebar di banyak sumber. Pemeriksaan manual membuat paket berisiko sulit diprioritaskan sebelum penetapan.",
    cue: "Tekankan masalah dan waktu intervensi: setelah penawaran ditutup, sebelum keputusan kontrak.",
  },
  {
    title: "Peran SARING",
    time: "00:35–01:05",
    route: "/dashboard",
    intro: true,
    body: "SARING menyatukan tiga jalur bukti untuk membantu Pokja dan reviewer menentukan urutan pemeriksaan. Sistem menerbitkan prioritas review dan bukti yang dapat ditelusuri—bukan vonis fraud.",
    cue: "Sebut pengguna utama: Pokja/UKPBJ, category expert atau PPK, dan APIP saat perlu eskalasi.",
  },
  {
    title: "Paket pengadaan aktual",
    time: "01:05–01:30",
    route: "/packages",
    selector: "[data-demo-tour='packages']",
    body: "Buka paket benchmark high-signal. Seluruh halaman berikut dirender dari package, analysis run, finding, dan source locator yang tersimpan—bukan kartu laporan hardcoded.",
    cue: "Klik nama paket SYN-LAPTOP-HIGHSIGNAL-002 bila ingin menunjukkan navigasi manual.",
  },
  {
    title: "Triase lintas engine",
    time: "01:30–02:00",
    route: `/packages/${HIGH_SIGNAL_DEMO_PACKAGE_ID}/findings`,
    selector: "[data-demo-tour='findings']",
    body: "Ringkasan memperlihatkan prioritas review, jumlah temuan, jumlah sumber, serta hasil Price, Document, dan Graph Engine pada analysis run yang sama.",
    cue: "Bedakan kekuatan pola dari kecukupan bukti. Keduanya bukan probabilitas vendor bersalah.",
  },
  {
    title: "Price Engine",
    time: "02:00–02:35",
    route: `/packages/${HIGH_SIGNAL_DEMO_PACKAGE_ID}/price`,
    selector: "[data-demo-tour-engine='PRICE']",
    body: "Price Engine membandingkan harga satuan dengan cohort barang sebanding sebelum cutoff. Q50, Q90, kuantitas, dan selisih total ditampilkan agar reviewer memahami sumber alert.",
    cue: "Tunjukkan rumus selisih terhadap Q90 × jumlah unit; tegaskan nilainya untuk verifikasi, bukan kerugian negara.",
  },
  {
    title: "Document Engine",
    time: "02:35–03:10",
    route: `/packages/${HIGH_SIGNAL_DEMO_PACKAGE_ID}/documents`,
    selector: "[data-demo-tour-engine='DOCUMENT']",
    body: "Document Engine mencari kemiripan passage non-template lintas vendor. Setiap sinyal membawa kutipan, halaman, bounding box, dan penjelasan alternatif untuk diverifikasi pada sumber.",
    cue: "Tunjukkan satu pasangan dokumen dan typo atau urutan kalimat langka yang sama.",
  },
  {
    title: "Graph Engine",
    time: "03:10–03:45",
    route: `/packages/${HIGH_SIGNAL_DEMO_PACKAGE_ID}/network`,
    selector: "[data-demo-tour-engine='GRAPH']",
    body: "Graph Engine menilai pola co-bidding berulang dari riwayat sebelum cutoff. Network view membantu reviewer memilih relasi yang perlu diperiksa lebih lanjut.",
    cue: "Tunjukkan edge, jumlah tender bersama, ambang historis, dan dated evidence trail.",
  },
  {
    title: "Evidence Brief",
    time: "03:45–04:20",
    route: `/packages/${HIGH_SIGNAL_DEMO_PACKAGE_ID}/brief`,
    selector: "[data-demo-tour='brief']",
    body: "Evidence Brief mengonsolidasikan temuan tiga engine beserta sumber dan keterbatasannya menjadi bahan keputusan manusia yang dapat dicetak atau disimpan sebagai PDF.",
    cue: "Tutup dengan nilai bisnis: waktu reviewer diarahkan ke paket dan bukti paling relevan, tanpa menggantikan keputusan manusia.",
  },
] as const;

export function GuidedDemoTour() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const step = steps[index];

  useEffect(() => {
    if (!active || !step.selector) return;
    const selector = step.selector;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const target = document.querySelector<HTMLElement>(selector);
      attempts += 1;
      if (!target && attempts < 25) return;
      window.clearInterval(timer);
      if (!target) return;
      target.classList.add("demo-tour-focus");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => {
      window.clearInterval(timer);
      document.querySelectorAll(".demo-tour-focus").forEach((element) => element.classList.remove("demo-tour-focus"));
    };
  }, [active, index, step.selector]);

  function goTo(nextIndex: number) {
    const bounded = Math.max(0, Math.min(steps.length - 1, nextIndex));
    setIndex(bounded);
    sessionStorage.setItem(storageKey, String(bounded));
    router.push(steps[bounded].route);
  }

  function start() {
    setActive(true);
    sessionStorage.setItem(storageKey, "0");
    router.push(steps[0].route);
  }

  function close() {
    setActive(false);
    sessionStorage.removeItem(storageKey);
    document.querySelectorAll(".demo-tour-focus").forEach((element) => element.classList.remove("demo-tour-focus"));
  }

  if (!active) {
    return (
      <button className="demo-tour-launch" type="button" onClick={start} aria-label="Mulai panduan demo 4 menit">
        <Clapperboard size={18} aria-hidden="true" />
        <span>Demo 4 menit</span>
      </button>
    );
  }

  return (
    <div className={step.intro ? "demo-tour-intro" : "demo-tour-dock"} role="dialog" aria-modal={step.intro} aria-label={`Panduan demo: ${step.title}`}>
      <div className="demo-tour-card">
        <div className="demo-tour-meta">
          <span>Bagian {index + 1} dari {steps.length}</span>
          <span>{step.time}</span>
          <button type="button" onClick={close} aria-label="Tutup panduan demo"><X size={18} /></button>
        </div>
        <div className="demo-tour-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
        <p className="demo-tour-kicker">SARING · panduan rekaman</p>
        <h2>{step.title}</h2>
        <p className="demo-tour-body">{step.body}</p>
        <p className="demo-tour-cue"><strong>Yang ditunjukkan:</strong> {step.cue}</p>
        <div className="demo-tour-actions">
          <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0}><ArrowLeft size={17} /> Sebelumnya</button>
          {index === steps.length - 1 ? (
            <button type="button" onClick={close}>Selesai <Clapperboard size={17} /></button>
          ) : (
            <button type="button" onClick={() => goTo(index + 1)}>Berikutnya <ArrowRight size={17} /></button>
          )}
        </div>
      </div>
    </div>
  );
}
