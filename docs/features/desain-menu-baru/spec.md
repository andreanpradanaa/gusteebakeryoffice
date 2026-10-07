# Spec: Desain Menu Baru → Approval → WhatsApp

- **Status:** Draft (rencana, belum dikerjakan)
- **Tanggal:** 2026-10-07
- **Figma/Canva:** belum ada template. Tahap 3 menunggu keputusan paket Canva.
- **Sumber:** diskusi dengan owner + kode `backend/orchestrator.go`, `llm.go`, `agents/prompts/`.

## Tujuan
Owner mengetik *"Ada menu baru: Croissant Pandan, launching Sabtu"*. Tim agen menghitung resep, HPP, harga, stok,
lalu Marketing menghasilkan **brief desain terstruktur**. Sistem membuat poster dari template, owner menyetujui di
aplikasi, dan hasilnya (gambar + ringkasan) dikirim ke WhatsApp.

## Alur target
```
Owner → CEO plan → R&D (resep+HPP) → Finance (harga) → Ops (stok) → Marketing (caption + brief JSON)
      → Generator poster (template) → Pratinjau + Setujui/Revisi → Kirim WhatsApp
```

Dikerjakan dalam 4 tahap. Tiap tahap bisa dipakai sendiri meski tahap berikutnya belum ada.

---

## Tahap 1 — Brief desain JSON dari Marketing (tanpa layanan luar)

### Backend
- **Deteksi menu baru**: fungsi `isNewMenuPrompt(prompt)` (kata kunci: *menu baru, produk baru, launching, varian baru*).
  Saat CEO membuat rencana, instruksi untuk `marketing` ditambah: *"sertakan brief desain"*.
- **Fungsi baru `LLM.BriefJSON(ctx, system, user) (*DesignBrief, error)`** di `llm.go` — salin pola `PlanJSON`
  (structured output Anthropic; fallback prompt JSON untuk OpenRouter). Dipanggil setelah `work()` Marketing selesai,
  dengan input = hasil Markdown Marketing + hasil Finance (harga) + hasil R&D (nama/deskripsi).
- **Struct `DesignBrief`** (JSON Schema, `additionalProperties:false`):

  | Field | Tipe | Batas | Sumber |
  |---|---|---|---|
  | `nama_menu` | string | ≤ 28 karakter | R&D |
  | `tagline` | string | ≤ 40 karakter | Marketing |
  | `deskripsi` | string | ≤ 120 karakter | Marketing |
  | `harga` | string | format `Rp18.000` | **Finance (wajib sama, tidak boleh diubah)** |
  | `harga_promo` | string \| null | format Rp | Finance |
  | `cta` | string | ≤ 30 karakter | Marketing |
  | `tanggal_launching` | string | `YYYY-MM-DD` atau null | prompt owner |
  | `format` | enum[] | `feed`, `story`, `kartu_harga` | Marketing |
  | `palet` | enum | `krem`, `cokelat`, `peach`, `hijau` (token Tailwind) | Marketing |
  | `caption_ig` | string | ≤ 400 karakter | Marketing |
  | `hashtag` | string[] | ≤ 8 | Marketing |
  | `catatan_foto` | string | arahan foto produk | Marketing |

- **Prompt**: file baru `agents/prompts/brief_desain.md` — aturan brand Gustee (hangat, lokal, palet krem/cokelat),
  batas karakter per kolom, larangan mengubah harga dari Finance, larangan klaim yang tidak bisa dipenuhi dapur.
  Dilampirkan ke system prompt Marketing hanya saat membuat brief.
- **Penyimpanan**: tabel `design_briefs` (`id, task_id, json, status, created_at`), status `draft`.
  Output juga dikirim lewat hub sebagai `Output` dengan `Title: "Brief desain"` dan `Content` = blok ```json
  supaya tampil di Hasil Kerja tanpa perubahan FE besar.
- **Mode demo** (`mock.go`): `mockBrief(sc, b)` mengisi brief dari template + HPP produk serupa agar alur bisa diuji
  tanpa API key.
- **Validasi** di Go setelah unmarshal: panjang string, format Rp, `harga` sama dengan angka Finance (regex dari
  output Finance; bila tidak ketemu → tandai `perlu_cek_harga: true`).

### Frontend
- `ResultsPanel`: output berjudul "Brief desain" dirender sebagai **kartu ringkas** (nama, tagline, harga, CTA,
  format, palet) + tombol "Salin JSON". Komponen baru `DesignBriefCard.tsx`.
- Tipe `DesignBrief` di `src/lib/types.ts` sinkron dengan struct Go.

### Test
- Go: table-driven untuk `isNewMenuPrompt`, validasi brief (batas karakter, format Rp, harga ≠ Finance),
  `mockBrief` menghasilkan JSON valid. Target coverage file baru ≥ 80%.
- FE: `DesignBriefCard` render semua field; `lib/markdown` parse blok json.

### Endpoint
Tidak ada endpoint baru. Brief ikut di `Task.outputs` dan event SSE `output`.

---

## Tahap 2 — Generator poster di backend (template HTML/SVG → PNG)
- Template SVG per format (`backend/templates/poster_feed.svg`, `poster_story.svg`, `kartu_harga.svg`) dengan
  placeholder `{{nama_menu}}` dst. dan token warna dari `tailwind.config.js`.
- Render: Go `text/template` → SVG → PNG via `resvg`/`rsvg-convert` (binary di server) **atau** render di browser
  (canvas) lalu unduh — diputuskan saat implementasi; default: render di browser (tanpa dependensi server).
- Endpoint `GET /api/designs/{id}/preview?format=feed` (SVG) dan tabel `designs`.
- FE: pratinjau di Hasil Kerja + tombol **Setujui** / **Revisi** (input teks → agen Marketing memperbaiki brief).
- Status brief: `draft → disetujui → terkirim`.

## Tahap 3 — Canva / Figma (opsional, menggantikan template lokal)
- **Canva Enterprise**: Connect API — Brand Template + Autofill + Export. Env `CANVA_CLIENT_ID/SECRET`,
  OAuth sekali oleh owner, token disimpan terenkripsi. Mapping field brief → kolom autofill.
- **Figma**: hanya ekspor PNG dari frame (REST), isi teks tidak bisa diubah via API non-Enterprise → tetap pakai
  tahap 2 untuk render, Figma sebagai sumber desain template.
- Keputusan: **tunggu konfirmasi paket Canva**. Tahap 2 tetap jadi fallback.

## Tahap 4 — Kirim WhatsApp
- Penyedia: **WhatsApp Business Cloud API (Meta)** — template pesan disetujui Meta, kirim gambar + teks.
  Alternatif uji coba: gateway lokal (Fonnte/Wablas), tidak untuk produksi.
- Endpoint `POST /api/designs/{id}/send` (hanya status `disetujui`). Env `WA_TOKEN`, `WA_PHONE_ID`, `WA_TO`.
- Isi pesan: gambar poster + ringkasan (nama, harga, HPP, margin, kebutuhan bahan, jadwal posting) + link edit.
- Log pengiriman di tabel `designs` (`sent_at`, `wa_message_id`, error).
- Security review wajib: token di env, tidak ada nomor di log, rate limit kirim.

---

## Urutan pengerjaan & estimasi
| Tahap | Perintah | Butuh dari owner | Perkiraan |
|---|---|---|---|
| 1 | `/feature brief-desain-menu-baru` | — | 1 sesi |
| 2 | `/feature poster-generator` | contoh desain poster (gambar/Canva/Figma) untuk ditiru | 1–2 sesi |
| 3 | `/feature canva-autofill` | paket Canva Enterprise + akun developer | 1 sesi, menunggu akses |
| 4 | `/feature kirim-whatsapp` | akun Meta Business + nomor + template disetujui | 1 sesi, menunggu approval Meta |

## Keputusan owner (2026-10-07)
| # | Pertanyaan | Keputusan | Dampak ke rencana |
|---|---|---|---|
| 1 | Paket Canva | **Canva Pro** | Autofill API hanya untuk Enterprise; Pro cuma dapat trial terbatas selama app masih "in development". → Tahap 3 **ditunda**; produksi memakai generator template lokal (tahap 2). Template bisa tetap didesain di Canva lalu diekspor sebagai SVG/PNG acuan. |
| 2 | Format poster | **Feed + story** | Tahap 2 membuat dua template: `poster_feed.svg` (1080×1080) dan `poster_story.svg` (1080×1920). Brief `format` default `["feed","story"]`. |
| 3 | Tujuan WhatsApp | **Owner, bisa dikonfigurasi** | Env `WA_TO` (default nomor owner), boleh daftar dipisah koma. Tahap lanjutan: pengaturan di UI (tabel `settings`). |
| 4 | Foto produk | **Generator gambar, bisa diganti** | Tahap 2b: interface `ImageGenerator` di Go (`Generate(ctx, prompt) (imageURL, error)`) dengan provider dipilih lewat env `IMAGE_PROVIDER` (`none` = unggah manual, `openai`, `gemini`, `fal`). Prompt foto dibuat dari `catatan_foto` di brief. Selalu ada tombol unggah manual untuk mengganti hasil generator. |
| 5 | Simpan menu ke DB | **Perlu** | Saat owner menekan **Setujui**: produk + resep + `recipe_items` dari output R&D disimpan ke `products`/`recipes` (R&D wajib mengeluarkan resep sebagai JSON terstruktur — pola sama dengan brief). Setelah itu HPP/margin/stok menu baru tampil di tab Data dan dipakai agen berikutnya. |

### Penyesuaian tahap
- **Tahap 1** ditambah: R&D juga mengeluarkan `RecipeJSON` (nama, kategori, harga dari Finance, yield, bahan+qty
  dipetakan ke `ingredients` yang ada; bahan baru ditandai `baru: true` dengan harga asumsi).
- **Tahap 2** ditambah: endpoint `POST /api/designs/{id}/approve` → simpan produk & resep ke DB (transaksi), ubah
  status `disetujui`. Bahan `baru: true` ikut dimasukkan ke `ingredients` dengan stok 0 dan `min_stock` dari Ops.
- **Tahap 2b (baru)**: generator foto produk dengan provider yang bisa diganti; fallback unggah manual.
- **Tahap 3**: ditunda sampai ada Canva Enterprise. Tidak memblokir tahap lain.
- **Tahap 4**: `WA_TO` multi-nomor.

### Keputusan tambahan
- Canva: pakai Canva biasa (Pro) hanya sebagai alat desain template; tahap 3 (Autofill) dicoret dari rencana.
- Generator gambar: belum ada provider → `IMAGE_PROVIDER=none` (unggah manual), interface tetap dibuat.
- Bahan baru: harga diasumsikan oleh agen R&D, ditandai `asumsi` di brief dan di tab Data.

## Pertanyaan terbuka
Tidak ada. Siap dikerjakan mulai tahap 1.
