---
description: Verifikasi visual layar yang berubah terhadap Figma/spec (state, responsif, aksesibilitas)
argument-hint: <nama-fitur atau komponen>
---

# /ui-check $ARGUMENTS

## 1. Siapkan
1. Baca spec `docs/features/$ARGUMENTS/spec.md` dan ekstrak `docs/figma/*.md` (jangan panggil MCP Figma).
2. Jalankan preview `backend` lalu `frontend` (`.claude/launch.json`), buka http://localhost:5173.

## 2. Periksa tiap state
- Normal, loading, kosong (belum ada tugas/hasil), error (backend mati → SSE terputus, submit gagal 400/429).
- Kirim satu tugas (mode demo) agar animasi, bubble, kanban, log, dan hasil terisi.
- Screenshot tiap state.

## 3. Responsif & tema
- Desktop (≥1280px), tablet (768px), mobile (375px: sidebar jadi bottom sheet, peta bisa digeser).
- Light & dark mode, override fase hari di header (pagi/siang/sore/malam).

## 4. Aksesibilitas dasar
Kontras teks pada palet krem/cokelat, fokus keyboard terlihat, tombol punya label, `aria-*` pada tab & dialog,
target sentuh ≥ 44px di mobile.

## 5. Laporan
Tabel: area → ekspektasi (Figma/spec) → hasil → selisih → saran perbaikan. Sertakan screenshot. Jangan commit.
