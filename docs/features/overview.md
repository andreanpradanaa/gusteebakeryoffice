# Overview Fitur — Gustee Bakery Office

- **Figma:** TODO — belum ada link (duplikat file ke draft sendiri, lalu jalankan `/figma-spec`).
- **Sumber sementara:** kode & README (2026-10-07). Bagian bertanda *(dari kode)* perlu divalidasi dengan desain.

## Area aplikasi *(dari kode)*
| Area | Screen / komponen | Keterangan |
|---|---|---|
| Header | `Header.tsx` | Judul, status koneksi SSE, mode demo/LLM, override fase hari, dark mode |
| Peta kantor | `OfficeCanvas.tsx` + `src/game/*` | Canvas 44×32 tile, 8 ruangan, agen & NPC, bubble, papan kanban dinding |
| Input tugas | `TaskInput.tsx` | Perintah ke CEO + saran cepat |
| Sidebar (desktop) / bottom sheet (mobile) | `Sidebar.tsx` | Tab: Log, Kanban, Hasil, Data |
| Activity log | `ActivityLog.tsx` | Timeline perintah, tanya/jawab antar-agen |
| Kanban | `KanbanBoard.tsx` | To Do / In Progress / Review / Done |
| Hasil Kerja | `ResultsPanel.tsx` | Rangkuman CEO + output agen, salin / unduh `.md` |
| Data | `DataPanel.tsx` | Omzet 30 hari, HPP & margin, stok gudang |
| Detail agen | `AgentPanel.tsx` | Klik karakter → profil, status, tugas, riwayat output |

## Glosarium
- **Agen** — CEO (Raka), Marketing (Nadia), Finance (Bima), R&D (Sari), Ops (Pak Joko).
- **Tugas** — perintah user ke CEO; dipecah menjadi **sub-tugas** per agen → **kartu kanban**.
- **Mode demo** — tanpa API key; jawaban dari template + angka DB (`mock.go`). **Mode LLM** — Anthropic/OpenRouter.
- **HPP** — harga pokok produksi dari resep × harga bahan.

## State machine
- **Tugas:** `antre → berjalan → selesai | gagal` (restart server: `antre/berjalan → gagal`).
- **Agen:** `idle ⇄ meeting ⇄ thinking ⇄ working` (berjalan antar ruangan di antaranya).
- **Kartu kanban:** `todo → progress → review → done`.

## Alur orkestrasi
Perintah → CEO merencanakan (sub-tugas) → rapat di ruang meeting → agen kembali ke ruangan & bekerja paralel
(boleh `tanya_agen` ke agen lain) → review → CEO merangkum → Hasil Kerja.

## Backend
- Katalog endpoint: lihat [`docs/api/endpoints.md`](../api/endpoints.md) (5 route, semua ada, tanpa auth).
- Struktur data: [`docs/db/schema.sql`](../db/schema.sql), gap: [`docs/db/gap-analysis.md`](../db/gap-analysis.md).

## Frontend
- **Navigasi:** satu halaman, tanpa router; tab di sidebar; panel detail agen sebagai overlay.
- **Inventaris komponen:** tabel di atas + `common.tsx` (komponen kecil bersama).
- **Design token:** `frontend/tailwind.config.js` (krem, cokelat roti, peach, hijau pastel) + palet canvas di `src/game/renderer.ts`.
- **Endpoint per screen:** TaskInput → `POST /api/tasks`; DataPanel → `GET /api/data/*`; semua panel → SSE `/api/events`.

## Fitur direncanakan
- [Desain menu baru → approval → WhatsApp](desain-menu-baru/spec.md) — Draft, 4 tahap.

## Pertanyaan terbuka
1. Apakah ada desain Figma resmi, atau UI saat ini menjadi acuan?
2. Fitur berikutnya yang diprioritaskan (CRUD data bakery, penjualan nyata, auth, riwayat tugas)?
