# Runbook Video Demo SARING (target 4 menit 20 detik)

## Tujuan

Video memperlihatkan produk yang benar-benar berjalan. Bagian bisnis mendapat 65 detik, sedangkan demonstrasi produk mendapat 195 detik. Narasi menjaga posisi SARING sebagai sistem prioritas review pra-penetapan, bukan alat yang memutuskan fraud.

## Persiapan sebelum merekam

1. Jalankan web, ingestion worker, serta service Price, Document, dan Graph Engine.
2. Login dan pastikan `SYN-LAPTOP-HIGHSIGNAL-002` sudah berstatus selesai dianalisis.
3. Buka `/dashboard`, atur browser 90–100%, resolusi minimal 1920×1080, lalu matikan notifikasi.
4. Klik tombol **Demo 4 menit** di kanan bawah. Tombol Berikutnya akan membuka halaman yang tepat.
5. Lakukan satu dry run. Jangan merekam proses tunggu ingestion; paket dapat disiapkan sebelumnya karena demo berfokus pada produk bekerja.

## Naskah dan aksi layar

### 00:00–00:35 — masalah bisnis

**Layar:** opening tour, tanpa slide terpisah.

**Narasi:**

> Pemeriksaan penawaran pengadaan menghadapi satu masalah mendasar: sinyal penting tersebar. Harga berada pada tabel penawaran, kemiripan bahasa berada di puluhan dokumen, sedangkan pola hubungan vendor tersembunyi pada riwayat partisipasi. Saat semuanya diperiksa manual, paket yang paling membutuhkan perhatian dapat terlambat diprioritaskan.

### 00:35–01:05 — solusi dan nilai bisnis

**Layar:** langkah kedua opening tour.

**Narasi:**

> SARING adalah sistem intelijen pra-penetapan yang bekerja setelah penawaran ditutup dan sebelum keputusan kontrak. SARING menyatukan bukti harga, dokumen, dan relasi vendor untuk membantu Pokja dan reviewer menentukan urutan pemeriksaan. Outputnya bukan vonis fraud, melainkan prioritas review, sumber yang dapat ditelusuri, penjelasan alternatif, dan bahan eskalasi manusia.

### 01:05–01:30 — package nyata

**Layar:** Packages, sorot paket `SYN-LAPTOP-HIGHSIGNAL-002`.

**Narasi:**

> Ini adalah package benchmark pengadaan laptop yang sudah masuk melalui pipeline aplikasi. Package memuat data vendor, penawaran, dokumen, harga pembanding, dan partisipasi historis. Status serta jumlah dokumen dan temuan di halaman ini berasal dari database workspace, bukan kartu demo hardcoded.

### 01:30–02:00 — triase lintas engine

**Layar:** Findings.

**Narasi:**

> Dalam satu analysis run, tiga engine menghasilkan temuan yang dikonsolidasikan pada halaman ini. Indeks prioritas dihitung dengan confidence-aware evidence fusion: kontribusi tiap engine disesuaikan dengan kecukupan bukti dan mendapat bonus hanya ketika beberapa engine saling menguatkan. Kekuatan pola tetap dipisahkan dari confidence agar angka tinggi tidak keliru dibaca sebagai probabilitas bersalah.

### 02:00–02:35 — Price Engine

**Layar:** Price Engine; berhenti pada satu finding dan rumus.

**Narasi:**

> Price Engine membandingkan harga satuan terhadap cohort barang sebanding yang tersedia sebelum cutoff analisis. Sistem menampilkan median Q50, batas atas Q90, dan deviasi penawaran. Selisih terhadap Q90 kemudian dikalikan jumlah unit untuk menunjukkan nilai yang perlu diverifikasi. Angka ini membantu memprioritaskan pemeriksaan spesifikasi, garansi, pajak, dan pengiriman; bukan estimasi kerugian negara.

### 02:35–03:10 — Document Engine

**Layar:** Document Engine; tampilkan satu pasangan passage.

**Narasi:**

> Document Engine memakai fingerprint exact, jalur tahan-noise OCR, serta retrieval MinHash dan Jaccard setelah redaksi template umum dikeluarkan. Pada pasangan ini, passage dan kesalahan penulisan yang tidak lazim muncul pada dua dokumen vendor. Reviewer tidak hanya menerima skor: SARING menyimpan kutipan, nomor halaman, bounding box, dan source locator. Kemungkinan sah seperti konsultan atau materi produsen yang sama tetap ditampilkan sebagai penjelasan alternatif.

### 03:10–03:45 — Graph Engine

**Layar:** network view dan evidence trail.

**Narasi:**

> Graph Engine membangun hubungan dari riwayat partisipasi sebelum cutoff. Ketebalan edge membantu memperlihatkan pasangan vendor yang berulang kali mengikuti tender bersama. Detailnya menunjukkan jumlah co-bid, ambang historis, serta paket dan tanggal pembentuk relasi. Pola statistik ini menjadi petunjuk pemeriksaan lanjutan, bukan bukti koordinasi dengan sendirinya.

### 03:45–04:20 — Evidence Brief dan penutup

**Layar:** Evidence Brief; scroll singkat dari header ke temuan dan sumber.

**Narasi:**

> Terakhir, seluruh finding aktual dikonsolidasikan menjadi Evidence Brief yang dapat dicetak atau disimpan sebagai PDF. Reviewer memperoleh alasan prioritas, bukti utama, keterbatasan, dan tindakan verifikasi tanpa kehilangan provenance dari masing-masing engine. Dengan begitu, SARING memindahkan pekerjaan dari pencarian manual yang tersebar menjadi pemeriksaan terarah, transparan, dan tetap berada di bawah keputusan manusia.

## Kalimat yang jangan digunakan

- Jangan mengatakan “SARING membuktikan fraud” atau “akurasi fraud 100%”.
- Jangan menyebut selisih harga sebagai kerugian negara.
- Jangan menyebut confidence sebagai probabilitas vendor bersalah.
- Jangan menyatakan benchmark sintetis sebagai validasi dunia nyata.

## Checklist pengumpulan

- Durasi final antara 03:00 dan 05:00; target aman 04:10–04:30.
- Suara jelas, pointer terlihat, dan teks utama terbaca pada 1080p.
- Produk hidup mendominasi minimal dua menit.
- Potong loading panjang, error terminal, alamat email, token, dan data rahasia.
- Unggah sebagai YouTube unlisted atau Google Drive, lalu uji tautan menggunakan jendela incognito sebelum dikirim.
