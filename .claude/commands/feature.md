---
description: Kerjakan fitur / perubahan / bug fix dengan alur wajib plan → TDD → build → review → selesai
argument-hint: <nama-fitur atau deskripsi bug>
---

# /feature $ARGUMENTS

Kerjakan tahap berurutan. **Jangan lompat tahap.** Tulis satu baris status setelah tiap tahap.

## 1. Plan
1. Baca `docs/features/$ARGUMENTS/spec.md` bila ada (atau `docs/features/overview.md`). Tidak ada spec dan perubahannya
   bukan bug fix kecil → tanya user apakah perlu `/figma-spec` dulu.
2. `graphify query "<inti fitur>"` untuk menemukan file & simbol terkait. Baca hanya potongan yang relevan.
3. Tentukan sisi yang disentuh: backend (`backend/*.go`), frontend (`frontend/src`), atau keduanya.
   Fullstack → kerjakan backend dulu, lalu frontend dengan kontrak yang sama (`docs/api/`, `src/lib/types.ts`).
4. Tulis rencana singkat: file yang diubah, test yang akan ditulis, risiko (security, kontrak SSE, prompt LLM).

## 2. TDD
1. Tulis test yang gagal dulu (RED): Go → `backend/*_test.go` (ikuti `/go-test`), FE → `*.test.ts(x)` (ikuti `/react-test`).
2. Implementasi minimal sampai hijau (GREEN), lalu refactor.
3. Coverage kode yang disentuh ≥ 80%: `go test -cover ./...` dan `npm run test:cov`.
4. Logika LLM: test lewat jalur mock/demo (`mock.go`), jangan memanggil API sungguhan.

## 3. Build, lint, format
- Backend: `go build ./... && go vet ./... && golangci-lint run ./...` — tidak boleh menambah issue baru.
- Frontend: `npm run build && npm run lint && npm run format:check`.
- Perbaiki sampai bersih (pakai agent `go-build-resolver` / `react-build-resolver` bila macet).

## 4. Review
- `/go-review` dan/atau `/react-review` pada diff (`git diff`).
- Agent `security-reviewer` wajib bila menyentuh: input user (`/api/tasks`), prompt/LLM, API key/env, SSE, SQL, storage,
  render markdown (`lib/markdown.ts`, DOMPurify).
- Perbaiki temuan CRITICAL/HIGH; laporkan sisanya.

## 5. Verifikasi visual (bila tampilan berubah)
Jalankan backend (`go run .`) + frontend (`npm run dev`) via preview, buka layar yang berubah, bandingkan dengan Figma/spec,
cek state loading/kosong/error/SSE terputus, mobile (375px) & desktop, light/dark. Ikuti `/ui-check`.

## 6. Selesai
1. Test akhir backend + frontend, laporkan hasil apa adanya.
2. Sinkron dokumen pendamping: endpoint berubah → `/postman` + `docs/api/`; tabel berubah → `docs/db/schema.sql` + gap-analysis.
3. `graphify update .`
4. Centang task di `docs/PROGRESS.md` (perbarui persen & bar) dan status di spec.
5. Ringkas ke user: apa yang berubah, hasil test/lint, sisa TODO.
6. **Jangan commit.** Usulkan pesan commit conventional (mis. `feat(frontend): tambah filter kanban per agen`).
