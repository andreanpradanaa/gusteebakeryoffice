---
description: Tarik desain Figma menjadi docs/features/<fitur>/spec.md dengan kuota MCP minimal
argument-hint: <link-figma-dengan-node-id> <nama-fitur>
---

# /figma-spec $ARGUMENTS

fileKey default: `TODO — belum ada link Figma` (isi setelah user memberi link duplikat).

## 1. Cek cache dulu (hemat kuota MCP ±20 panggilan/bulan)
1. Ambil node-id dari link di `$ARGUMENTS`; nama fitur = argumen terakhir (kebab-case).
2. Cari di `docs/figma/*.md` apakah screen/node itu sudah diekstrak. Bila sudah → pakai, **jangan panggil MCP**.
3. Bila belum: panggil `get_design_context` sekali untuk node itu (muat skill `figma:figma-design-to-code` dulu).
   Simpan ekstrak mentah ke `docs/figma/gustee-office-screens.md` (section per node, sertakan node-id & tanggal).
4. Laporkan jumlah panggilan MCP.

## 2. Tulis `docs/features/<fitur>/spec.md`
Repo ini fullstack → spec berisi dua bagian.

### Bagian Backend
- Endpoint (method, path, auth), request/response JSON, validasi, kode status & pesan error (Bahasa Indonesia).
- Event SSE baru/berubah (`type`, payload) — sinkron dengan `frontend/src/lib/types.ts`.
- Entitas/tabel SQLite yang disentuh (`backend/db.go`), aturan bisnis (HPP, stok, agen yang terlibat, prompt).

### Bagian Frontend
- Screen/tab & navigasi; komponen dipakai (petakan ke `src/components/*`) dan komponen baru.
- State per screen (store `useOffice`), loading/kosong/error/SSE terputus.
- Form & validasi klien; endpoint yang dikonsumsi (rujuk `docs/api/`).
- Responsif (mobile bottom sheet vs desktop sidebar), aksesibilitas (kontras, keyboard, aria), dark mode.

### Penutup
- Pertanyaan terbuka (bernomor), status: Draft.

## 3. Sinkronkan
Tambahkan fitur ke `docs/features/overview.md` dan `docs/PROGRESS.md` (checklist). Endpoint baru tanpa kontrak →
tambahkan ke `docs/api/` bertanda "butuh konfirmasi".
