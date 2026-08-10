# Package Delete and Guided Demo Tour Changelog — 2026-08-10

## Ringkasan

Pembaruan ini menambahkan dua kemampuan untuk pengujian dan presentasi SARING:

1. penghapusan package secara aman agar ingestion dan reproducibility test dapat diulang;
2. guided tour berdurasi sekitar empat menit untuk mendemonstrasikan alur bisnis dan hasil engine aktual.

## Package deletion

- Menambahkan permission `package:delete` untuk role yang berwenang.
- Menambahkan endpoint penghapusan package berbasis workspace.
- Penghapusan menggunakan dialog konfirmasi satu layar yang menampilkan nama dan ID package.
- Tombol final dibuat eksplisit untuk mengurangi risiko salah klik.
- Setelah berhasil, directory package diperbarui tanpa reload manual.

## Guided demo tour

- Menambahkan tombol global **Demo 4 menit** pada workspace.
- Dua langkah awal menjelaskan masalah bisnis dan posisi SARING sebagai sistem review pra-penetapan.
- Langkah produk membuka Packages, Findings, Price, Document, Graph, dan Evidence Brief secara berurutan.
- Setiap langkah memuat time cue, arahan presenter, progress, serta highlight pada komponen produk nyata.
- Tour menggunakan `SYN-LAPTOP-HIGHSIGNAL-002` sebagai package demonstrasi dan tidak mengganti output analysis run dengan placeholder.
- Naskah rekaman tersedia di `docs/DEMO_VIDEO_RUNBOOK_3_TO_5_MIN.md`.

## Validasi

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Ketiganya lulus pada working tree sebelum commit.
