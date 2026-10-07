# Gap Analysis — Database

- **Sumber:** `docs/db/schema.sql` (diekstrak dari `backend/db.go`), seed `backend/data/seed.json`, kode `backend/*.go`
- **Tanggal:** 2026-10-07
- **DB:** SQLite (file `gustee.db`, WAL), diisi ulang dari seed saat DB kosong. Tidak ada folder migrasi.

**Legenda:** ✅ lengkap dipakai · 🟡 ada tapi terbatas · ❌ belum ada

## Kesimpulan
Skema cukup untuk demo kantor virtual: data bakery (bahan, resep, produk, penjualan) read-only, dan jejak kerja agen
(tugas, output, log, kanban) tersimpan. Belum ada migrasi berversi, index, foreign key, maupun data penjualan nyata
(penjualan 30 hari disintesis dari `base_daily_sales`). Desain Figma belum tersedia sehingga gap desain belum dianalisis.

## Mapping tabel ↔ fitur
| Tabel | Fitur | Status | Catatan |
|---|---|---|---|
| `ingredients` | Tab Data › Stok, konteks Ops/Finance/R&D | ✅ | Peringatan stok < `min_stock`; stok tidak pernah berkurang |
| `recipes`, `recipe_items` | HPP, costing R&D, kebutuhan bahan | ✅ | Tanpa FK ke `ingredients` |
| `products`, `product_bundle` | Tab Data › HPP & margin, harga jual | ✅ | `product_bundle` untuk hampers/paket |
| `sales` | Tab Data › Omzet 30 hari, proyeksi Finance | 🟡 | Data sintetis dari seed; belum ada input penjualan nyata |
| `tasks` | Input tugas, riwayat, antrean | ✅ | Status `antre/berjalan/selesai/gagal`; ditandai gagal saat restart |
| `outputs` | Hasil Kerja (per agen + rangkuman CEO) | ✅ | Konten markdown |
| `logs` | Activity log | ✅ | `kind`: perintah/pesan/tanya/jawab/sistem/hasil |
| `kanban` | Kanban board + papan dinding | ✅ | Kolom `todo/progress/review/done` |

## Gap
- **G1** — Tidak ada migrasi berversi; perubahan skema hanya lewat `CREATE TABLE IF NOT EXISTS` (kolom baru tidak teraplikasi ke DB lama).
- **G2** — Tidak ada index (`outputs.task_id`, `logs.time`, `kanban.task_id`, `sales.date`); aman untuk data kecil, lambat bila riwayat tumbuh.
- **G3** — Tidak ada foreign key / constraint (`recipe_items`, `product_bundle`, `outputs.task_id`).
- **G4** — Penjualan sintetis; belum ada endpoint/tabel untuk mencatat transaksi atau mutasi stok.
- **G5** — Tidak ada retensi/pembersihan riwayat tugas, log, dan output.
- **G6** — Belum ada pengguna/auth; semua pengunjung berbagi kantor yang sama (by design, perlu dikonfirmasi).

## Pertanyaan terbuka
1. Apakah data bakery akan diedit dari UI (CRUD produk/bahan) atau tetap dari seed?
2. Perlukah penjualan nyata (input kasir / impor CSV)?
3. Apakah kantor tetap publik tanpa login, atau perlu auth + kantor per pengguna?
4. Berapa lama riwayat tugas perlu disimpan?
