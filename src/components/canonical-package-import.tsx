"use client";

import {
  ArrowRight,
  Check,
  FileArchive,
  FolderArchive,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { StoredPackageOption } from "@/lib/intake/library";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const acceptedExtensions = [".zip", ".json"];
const maxUploadBytes = 50 * 1024 * 1024;

type UploadPhase = "idle" | "preparing" | "uploading" | "validating";

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

function isAcceptedFile(file: File) {
  return acceptedExtensions.some((extension) =>
    file.name.toLowerCase().endsWith(extension),
  );
}

function bundleContentType(fileName: string) {
  return fileName.toLowerCase().endsWith(".zip")
    ? "application/zip"
    : "application/json";
}

export function CanonicalPackageImport({ bundles }: { bundles: readonly StoredPackageOption[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [chosenBundle, setChosenBundle] = useState<StoredPackageOption | null>(null);
  const [pendingBundleId, setPendingBundleId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");

  const filteredBundles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || chosenBundle?.name.toLowerCase() === normalizedQuery) {
      return bundles;
    }

    return bundles.filter((bundle) =>
      [bundle.id, bundle.name, bundle.context, bundle.records]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [bundles, chosenBundle, query]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isAcceptedFile(file) || file.size < 1 || file.size > maxUploadBytes) {
      setUploadedFile(null);
      setError("Choose a canonical ZIP or JSON package no larger than 50 MiB.");
      return;
    }

    setUploadedFile(file);
    setChosenBundle(null);
    setError(null);
    setUploadPhase("preparing");
    try {
      const contentType = bundleContentType(file.name);
      const intentResponse = await fetch("/api/package-uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          byteSize: file.size,
          mimeType: contentType,
        }),
      });
      if (!intentResponse.ok) {
        throw new Error(await responseError(intentResponse, "The private upload could not be prepared."));
      }
      const intent = await intentResponse.json() as {
        uploadId: string;
        bucket: string;
        objectKey: string;
        token: string;
      };

      setUploadPhase("uploading");
      const uploadBody = new Blob([file], { type: contentType });
      const { error: uploadError } = await createSupabaseBrowserClient()
        .storage.from(intent.bucket)
        .uploadToSignedUrl(intent.objectKey, intent.token, uploadBody, {
          contentType,
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message);

      setUploadPhase("validating");
      const finalizeResponse = await fetch(
        `/api/package-uploads/${encodeURIComponent(intent.uploadId)}/finalize`,
        { method: "POST" },
      );
      if (!finalizeResponse.ok) {
        throw new Error(await responseError(finalizeResponse, "The canonical bundle did not pass validation."));
      }
      const result = await finalizeResponse.json() as {
        packageId: string;
        status: "FINALIZED" | "QUEUED_FOR_INGESTION";
      };
      const nextStep = result.status === "QUEUED_FOR_INGESTION" ? "ingestion" : "readiness";
      router.push(`/packages/${encodeURIComponent(result.packageId)}/${nextStep}`);
    } catch (caught) {
      setUploadPhase("idle");
      setUploadedFile(null);
      event.target.value = "";
      setError(caught instanceof Error ? caught.message : "The package could not be imported.");
    }
  }

  function openBrowser() {
    setPendingBundleId(chosenBundle?.id ?? null);
    setBrowserOpen(true);
  }

  function confirmStoredBundle() {
    const bundle = bundles.find((item) => item.id === pendingBundleId);
    if (!bundle) return;

    setChosenBundle(bundle);
    setUploadedFile(null);
    setQuery(bundle.name);
    setBrowserOpen(false);
    setError(null);
    router.push(`/packages/${encodeURIComponent(bundle.id)}/readiness`);
  }

  return (
    <div className="flex min-h-[calc(100dvh-300px)] items-center justify-center px-6 py-14">
      <section className="w-full max-w-3xl text-center" aria-labelledby="import-package-title">
        <div className="mx-auto grid size-[84px] place-items-center rounded-[22px] border-2 border-[#d7d9dd] bg-white text-[#17191d] shadow-[0_22px_46px_-20px_rgb(11_27_67_/_48%),0_8px_18px_-12px_rgb(20_80_230_/_30%)]">
          <FolderArchive size={38} strokeWidth={1.8} aria-hidden="true" />
        </div>

        <h1 id="import-package-title" className="mt-12 text-3xl font-bold tracking-[-0.025em] text-[#17191d]">
          Choose the package evidence bundle
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-[#647493]">
          Upload a new package or search stored test bundles to review and run again.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          onChange={handleChange}
          className="sr-only"
        />

        <div className="mx-auto mt-7 flex max-w-[720px] items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadPhase !== "idle"}
            aria-label="Upload local package bundle"
            className={`inline-flex h-14 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-[#17191d] text-base font-bold text-white transition-[width,padding,background-color] duration-300 hover:bg-black disabled:cursor-wait disabled:opacity-60 ${
              browserOpen ? "w-14 px-0" : "w-[190px] px-7"
            }`}
          >
            <Plus
              className={`shrink-0 transition-[width,height] duration-300 ${browserOpen ? "!size-[34px]" : "!size-[30px]"}`}
              strokeWidth={2.1}
              aria-hidden="true"
            />
            <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ${browserOpen ? "max-w-0 opacity-0" : "max-w-32 opacity-100"}`}>
              {uploadPhase === "idle" ? "Upload" : "Working"}
            </span>
          </button>

          <div className={`flex h-14 min-w-0 flex-1 items-center gap-3 rounded-full border bg-white py-1.5 pl-5 pr-1.5 text-left transition-all duration-300 ${
            browserOpen
              ? "border-[#8f9aad] shadow-[0_8px_24px_-18px_rgb(11_27_67_/_45%)] ring-2 ring-[#1450e6]/10"
              : "border-[#c8cbd1]"
          }`}>
            <Search size={19} className="shrink-0 text-[#647493]" aria-hidden="true" />
            <span className="sr-only">Search stored package bundles</span>
            <input
              type="search"
              aria-label="Search stored package bundles"
              value={query}
              onFocus={openBrowser}
              onChange={(event) => {
                setQuery(event.target.value);
                setChosenBundle(null);
                setBrowserOpen(true);
              }}
              placeholder="Search stored packages..."
              className="min-w-0 flex-1 bg-transparent text-base text-[#17191d] outline-none placeholder:text-[#77869f]"
            />
            <button
              type="button"
              onClick={openBrowser}
              aria-label="Browse stored package bundles"
              className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-[#1450e6] bg-[#1450e6] text-[#c7ff00] shadow-[0_5px_12px_-7px_rgb(20_80_230_/_65%)] transition hover:bg-[#0c43cc]"
            >
              {chosenBundle ? (
                  <Check color="#c7ff00" size={19} strokeWidth={2.3} aria-hidden="true" />
                ) : (
                  <ArrowRight color="#c7ff00" size={19} strokeWidth={2.3} aria-hidden="true" />
                )}
            </button>
          </div>
        </div>

        <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2.5">
          {[
            "One tender package",
            "Immutable source files",
            "Manifest + SHA-256",
            "Pre-award cutoff",
            "Authorized or synthetic",
          ].map((label) => (
            <span key={label} className="rounded-full bg-[#ececeb] px-4 py-2 text-sm font-medium text-[#17191d]">
              {label}
            </span>
          ))}
        </div>

        <div aria-live="polite">
        {error ? (
          <p role="alert" className="mt-5 text-sm font-semibold text-[#b83a32]">{error}</p>
        ) : uploadPhase !== "idle" ? (
          <p className="mt-5 text-sm font-semibold text-[#1450e6]">
            {uploadPhase === "preparing" ? "Preparing private upload…" : uploadPhase === "uploading" ? "Uploading immutable bundle…" : "Validating manifest, hashes, and package identity…"}
          </p>
        ) : uploadedFile ? (
          <p className="mt-5 text-sm font-medium text-[#647493]">
            Local package selected: <strong className="text-[#17191d]">{uploadedFile.name}</strong>
          </p>
        ) : chosenBundle ? (
          <p className="mt-5 text-sm font-medium text-[#647493]">
            Stored package selected: <strong className="text-[#17191d]">{chosenBundle.id}</strong>
          </p>
        ) : null}
        </div>
      </section>

      <aside
        aria-hidden={!browserOpen}
        inert={!browserOpen ? true : undefined}
        aria-label="Stored package bundles"
        className={`absolute inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l-2 border-[#8f9aad] bg-white shadow-[-24px_0_56px_-34px_rgb(11_27_67_/_55%)] transition-transform duration-300 ease-out ${
          browserOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#d7d9dd] px-6 py-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#1450e6]">Package library</p>
            <h2 className="mt-1 text-xl font-bold text-[#17191d]">Stored packages</h2>
            <p className="mt-1 text-sm leading-6 text-[#647493]">Choose an existing package to inspect or run again.</p>
          </div>
          <button
            type="button"
            onClick={() => setBrowserOpen(false)}
            aria-label="Close package library"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ececeb] text-[#17191d] hover:bg-[#dededc]"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="border-b border-[#e5e6e8] p-5">
          <label className="flex h-12 items-center gap-3 rounded-full border border-[#c8cbd1] bg-white px-4 focus-within:border-[#8f9aad] focus-within:ring-2 focus-within:ring-[#1450e6]/10">
            <Search size={18} className="text-[#647493]" aria-hidden="true" />
            <span className="sr-only">Filter stored bundles</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by file, ID, or scenario..."
              className="min-w-0 flex-1 bg-transparent text-base text-[#17191d] outline-none placeholder:text-[#77869f]"
            />
          </label>
        </div>

        <div className="ui-scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-5">
          <p className="mb-3 text-sm font-medium text-[#647493]">{filteredBundles.length} results</p>
          <div className="grid gap-3">
            {filteredBundles.map((bundle) => {
              const selected = pendingBundleId === bundle.id;
              return (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => setPendingBundleId(bundle.id)}
                  className={`flex items-start gap-4 rounded-xl border-2 p-4 text-left transition ${
                    selected
                      ? "border-[#1450e6] bg-[#f3f6ff]"
                      : "border-[#e0e1e3] bg-white hover:border-[#b8bbc2] hover:bg-[#fafafa]"
                  }`}
                >
                  <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${selected ? "bg-[#1450e6] text-white" : "bg-[#ececeb] text-[#2d3f66]"}`}>
                    <FileArchive size={21} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-[#17191d]">{bundle.name}</span>
                    <span className="mt-1 block text-sm text-[#526383]">{bundle.context}</span>
                    <span className="mt-1 block font-mono text-sm text-[#77869f]">{bundle.id} · {bundle.records}</span>
                  </span>
                  <span className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border ${selected ? "border-[#1450e6] bg-[#1450e6] text-white" : "border-[#b8bbc2]"}`}>
                    {selected ? <Check size={13} strokeWidth={2.5} aria-hidden="true" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[#d7d9dd] bg-[#f7f7f6] px-6 py-5">
          <button
            type="button"
            onClick={() => setBrowserOpen(false)}
            className="h-11 rounded-full border border-[#b8bbc2] bg-white px-5 text-base font-semibold text-[#2d3f66] hover:bg-[#ececeb]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmStoredBundle}
            disabled={!pendingBundleId}
            className="h-11 rounded-full bg-[#c7ff00] px-7 text-base font-bold text-[#0b1b43] transition hover:bg-[#b9ee00] disabled:cursor-not-allowed disabled:opacity-45"
          >
            OK
          </button>
        </footer>
      </aside>
    </div>
  );
}
