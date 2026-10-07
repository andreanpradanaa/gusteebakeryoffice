# Gustee Bakery Office

Kantor virtual pixel-art: 5 agen AI (CEO, Marketing, Finance, R&D, Ops) bekerja atas perintah user, ditonton real-time.

## Stack & struktur
- **backend/** — Go 1.24, `net/http` stdlib, SQLite (`modernc.org/sqlite`), satu `package main` datar (bukan layered):
  `main.go` (routing + handler API + SSE) → `orchestrator.go` (alur CEO → rapat → agen paralel → review → rangkuman)
  → `llm.go` (Anthropic/OpenRouter, streaming, tool `tanya_agen`) | `mock.go` (mode demo tanpa API key)
  → `bakery.go` (HPP, margin, kebutuhan bahan) → `db.go` (skema + query). `hub.go` = event bus SSE + snapshot.
  Agen & prompt di `backend/agents/` (JSON + markdown), seed di `backend/data/seed.json`.
- **frontend/** — React 18 + TS + Vite 5 + Tailwind 3 + Zustand. Tanpa router (satu layar + tab).
  `src/store/useOffice.ts` (state global, konsumsi SSE) · `src/lib/api.ts` (fetch + EventSource) ·
  `src/game/` (canvas: map, sprite, engine, renderer) · `src/components/` (panel UI) · token warna di `tailwind.config.js`.
- Kontrak FE↔BE: REST `/api/*` + SSE `/api/events`; tipe di `frontend/src/lib/types.ts` harus sinkron dengan struct Go.

## Spec fitur
- `docs/features/overview.md` (indeks fitur), `docs/features/<fitur>/spec.md` (dibuat via `/figma-spec`).
- BE: `docs/db/schema.sql` (diekstrak dari `backend/db.go`) + `docs/db/gap-analysis.md`.
- FE: `docs/api/` (kontrak endpoint & event SSE) + inventaris komponen di overview.
- Progres: `docs/PROGRESS.md`. Indeks dokumen: `docs/README.md`.

## Workflow pengerjaan fitur
Setiap fitur baru / perubahan / bug fix — meskipun user tidak mengetik command — ikuti `.claude/commands/feature.md`:
plan (spec + graphify) → TDD (`/go-test` atau `/react-test`), coverage ≥ 80% untuk kode yang disentuh →
build/type-check/lint/format bersih → review (`/go-review`, `/react-review`) + agent `security-reviewer` bila menyentuh
input user, prompt LLM, API key, SSE, atau storage → test akhir + `graphify update .` →
`/postman` bila endpoint berubah, `/ui-check` bila tampilan berubah → update `docs/PROGRESS.md`.
Perubahan kecil (typo, teks, config) boleh lewati TDD dan review.

## Hemat token
- `graphify query "<pertanyaan>"` dulu sebelum membaca file; `graphify path`/`explain` untuk relasi.
- Jangan `cat` file besar (`renderer.ts`, `orchestrator.go`, `mock.go`): pakai `grep -n` / `sed -n 'a,bp'`.
- Figma dibaca dari `docs/figma/` dan spec; MCP Figma hanya lewat `/figma-spec`.
- Pangkas output tool (`| tail`, `| head`, `--stat`). Pekerjaan berlog panjang → subagent.
- Format + pemeriksaan cepat sudah otomatis via hook `.claude/hooks/format.sh`.

## Git
Jangan pernah `git commit` / `git push` (diblokir hook). User commit manual per fitur; cukup usulkan pesan commit
(conventional commits, mis. `feat(backend): ...`).

## Perintah (sudah diverifikasi)
| Tujuan | Backend (`cd backend`) | Frontend (`cd frontend`) |
|---|---|---|
| Test + coverage | `go test -cover ./...` | `npm run test:cov` |
| Build / type-check | `go build ./... && go vet ./...` | `npm run build` (`npm run typecheck`) |
| Lint | `golangci-lint run ./...` | `npm run lint` |
| Format | `gofmt -w .` | `npm run format` (cek: `npm run format:check`) |
| Dev server | `go run .` (:8080, mode demo bila tanpa API key) | `npm run dev` (:5173, proxy `/api` → :8080) |

Env: salin `backend/.env.example` → `backend/.env`. Jangan baca `.env`.
