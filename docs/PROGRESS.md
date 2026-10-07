# Progres — Gustee Bakery Office

**Tanggal:** 2026-10-07 · **Total:** 30/49 task (61%)
Sumber: kode saat ini (belum ada Figma). Perbarui setiap selesai `/feature`.

| Prio | Fitur | Progres | % | x/y | Status |
|---|---|---|---|---|---|
| P0 | Fondasi | ██████░░░░ | 58% | 7/12 | Berjalan |
| P0 | Orkestrasi agen | ██████████ | 100% | 6/6 | Selesai |
| P0 | Peta kantor & animasi | ██████████ | 100% | 6/6 | Selesai |
| P0 | Panel UI (log, kanban, hasil, detail agen) | ██████████ | 100% | 5/5 | Selesai |
| P1 | Tab Data bakery | ██████████ | 100% | 4/4 | Selesai |
| P1 | Kualitas & test | █░░░░░░░░░ | 14% | 1/7 | Berjalan |
| P2 | Pengembangan lanjutan | ██░░░░░░░░ | 25% | 1/4 | Berjalan |
| P1 | Desain menu baru → WhatsApp | ░░░░░░░░░░ | 0% | 0/5 | Belum mulai |

**Legenda:** Belum mulai · Berjalan · Selesai · Terblokir. Bar = 10 blok (1 blok = 10%).

## Fondasi
- [x] DB SQLite + seed otomatis
- [x] Config dari env + `.env.example` (backend & frontend)
- [x] Provider LLM (Anthropic / OpenRouter) + mode demo
- [x] Event bus SSE + snapshot
- [x] HTTP client & SSE client FE
- [x] State global (Zustand) + theme/token Tailwind, dark mode
- [x] Setup Claude Code (CLAUDE.md, commands, hooks, docs)
- [ ] Migrasi DB berversi (G1)
- [ ] Auth (bila diputuskan, G6)
- [ ] CI (lint → test → build) — TODO, CI belum dipilih
- [ ] Target deploy — TODO
- [ ] Figma / design system resmi — TODO

## Orkestrasi agen
- [x] CEO memecah perintah jadi sub-tugas
- [x] Rapat + agen bekerja paralel
- [x] Tool `tanya_agen` antar-agen
- [x] Review + rangkuman CEO
- [x] Antrean tugas + batas (429)
- [x] Prompt per agen (`agents/prompts`)

## Peta kantor & animasi
- [x] Tile map + ruangan + furnitur
- [x] Pathfinding BFS
- [x] Sprite & animasi aktivitas
- [x] NPC pembeli & baker
- [x] Bubble chat streaming
- [x] Siklus pagi/siang/sore/malam (WIB)

## Panel UI
- [x] Input tugas + saran cepat
- [x] Activity log
- [x] Kanban (panel + papan dinding)
- [x] Hasil Kerja (salin / unduh .md)
- [x] Panel detail agen

## Tab Data bakery
- [x] Omzet 30 hari
- [x] HPP & margin per produk
- [x] Stok gudang + peringatan minimum
- [x] Costing resep

## Kualitas & test
- [x] Test backend mode demo (`mock_test.go`, coverage 43%)
- [ ] Coverage backend ≥ 80% (handler API, bakery, orchestrator)
- [ ] Test frontend: store `useOffice`, `lib/api`, `lib/markdown` (coverage 1,6%)
- [ ] Bersihkan 28 issue golangci-lint
- [ ] Rapikan format Prettier (21 file)
- [ ] Postman collection divalidasi terhadap server berjalan
- [ ] E2E / verifikasi visual otomatis

## Pengembangan lanjutan
- [x] Kantor bersama real-time (SSE)
- [ ] CRUD data bakery dari UI
- [ ] Penjualan nyata / mutasi stok (G4)
- [ ] Retensi riwayat tugas (G5)

## Desain menu baru → WhatsApp
Spec: [features/desain-menu-baru/spec.md](features/desain-menu-baru/spec.md)
- [ ] Tahap 1: brief desain JSON dari Marketing (+ mode demo, kartu di Hasil Kerja)
- [ ] Tahap 2: generator poster (feed + story) + Setujui/Revisi + simpan produk & resep ke DB
- [ ] Tahap 2b: generator foto produk (provider bisa diganti, fallback unggah manual)
- [ ] Tahap 3: Canva Autofill — ditunda (butuh Enterprise, Pro tidak cukup)
- [ ] Tahap 4: kirim WhatsApp (Meta Cloud API)
