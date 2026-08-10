"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";

type ErrorPayload = { error?: { message?: string } };

export function PackageDeleteControl({
  packageId,
  packageName,
}: {
  packageId: string;
  packageName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, submitting]);

  function close() {
    if (submitting) return;
    setOpen(false);
    setConfirmation("");
    setError(null);
  }

  async function deletePackage() {
    if (confirmation !== packageId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(packageId)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = await response.json().catch(() => ({})) as ErrorPayload;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Package gagal dihapus.");
      }
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Package gagal dihapus.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#6f3030] px-3 py-2 text-xs font-bold text-[#ff9d9d] transition hover:border-[#e34848] hover:bg-[#351a1a] hover:text-white"
        aria-label={`Hapus package ${packageName}`}
      >
        <Trash2 size={14} /> Hapus
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto bg-[#08090b]/95 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-title-${packageId}`}
        >
          <section className="w-full max-w-2xl rounded-2xl border border-[#673535] bg-[#131416] shadow-2xl">
            <header className="flex items-start justify-between gap-5 border-b border-[#352729] px-6 py-5 sm:px-8">
              <div className="flex gap-4">
                <span className="mt-0.5 rounded-full bg-[#401e21] p-3 text-[#ff7777]"><AlertTriangle size={24} /></span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff7777]">Tindakan permanen</p>
                  <h2 id={`delete-title-${packageId}`} className="mt-1 text-2xl font-black text-white">Hapus package?</h2>
                </div>
              </div>
              <button type="button" onClick={close} disabled={submitting} className="rounded-md p-2 text-[#8d929b] hover:bg-[#25272b] hover:text-white" aria-label="Tutup konfirmasi"><X size={22} /></button>
            </header>

            <div className="px-6 py-6 sm:px-8">
              <p className="text-base font-semibold leading-7 text-[#c7cbd2]">
                Package <strong className="text-white">{packageName}</strong> beserta dokumen,
                ingestion, hasil analysis, finding, dan artefak storage terkait akan dihapus.
                Master vendor yang mungkin digunakan package lain tidak ikut dihapus.
              </p>
              <div className="mt-5 rounded-xl border border-[#3a3d43] bg-[#0d0e10] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#858b95]">Ketik ID berikut untuk mengonfirmasi</p>
                <code className="mt-2 block break-all text-sm font-black text-[#ff9d9d]">{packageId}</code>
                <input
                  autoFocus
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={submitting}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-4 w-full rounded-lg border border-[#444850] bg-[#181a1e] px-4 py-3 font-mono text-sm font-bold text-white outline-none transition focus:border-[#ff6868] focus:ring-2 focus:ring-[#ff6868]/20"
                  placeholder="Masukkan ID package"
                />
              </div>
              {error && <p className="mt-4 rounded-lg border border-[#71383b] bg-[#351b1d] px-4 py-3 text-sm font-bold text-[#ffadad]" role="alert">{error}</p>}
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-[#352729] px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
              <button type="button" onClick={close} disabled={submitting} className="rounded-lg border border-[#45484f] px-5 py-3 text-sm font-bold text-[#c7cbd2] hover:bg-[#24262a] hover:text-white">Batal</button>
              <button
                type="button"
                onClick={deletePackage}
                disabled={confirmation !== packageId || submitting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d83434] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ed4545] disabled:cursor-not-allowed disabled:bg-[#3d292b] disabled:text-[#80696b]"
              >
                {submitting ? <LoaderCircle size={17} className="animate-spin" /> : <Trash2 size={17} />}
                {submitting ? "Menghapus package…" : "Hapus package secara permanen"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
