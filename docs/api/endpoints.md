# Endpoint

Base URL dev: `http://localhost:8080` (FE dev lewat proxy Vite `/api`). Semua endpoint **publik** (tanpa auth).
Error berbentuk `{"error": "<pesan Bahasa Indonesia>"}`. CORS: `CORS_ORIGIN` (default `*`).

## GET /api/health
Status server. **200** `{"ok": true, "mode": "demo" | "llm", "model": "claude-opus-5-5"}`.
Dipakai: belum dipakai FE (mode didapat dari snapshot SSE).

## GET /api/agents
Daftar agen dari `backend/agents/agents.json`. **200** `Agent[]` (id, name, role, room, …). Dipakai: belum dipakai FE
(tampilan agen dari `src/config/agents.ts`).

## GET /api/tasks
50 tugas terakhir. **200** `Task[]` — `{id, prompt, status: antre|berjalan|selesai|gagal, mode, createdAt, finishedAt?, summary?, outputs[]}`.
**500** error DB. Dipakai: store `useOffice` (riwayat).

## POST /api/tasks
Kirim perintah ke CEO. Body `{"prompt": "string"}` (maks 8 KB body, 1–1000 karakter setelah trim).

| Kode | Arti |
|---|---|
| 201 | `Task` baru (status `antre`) |
| 400 | `body tidak valid` / `perintah wajib diisi (maks 1000 karakter)` |
| 429 | `antrean tugas penuh, coba lagi nanti` |
| 405 | method selain GET/POST |

Dipakai: `TaskInput` (input tugas + saran cepat).

## GET /api/data/{kind}
`kind` ∈ `products` (dengan `hpp`, `margin`) · `ingredients` · `recipes` (dengan `batchCost`, `unitCost`) ·
`sales` (`{total, daily[], byProduct[]}`). **404** kind lain, **500** error DB. Dipakai: `DataPanel` (tab Data).

## GET /api/events (SSE)
`text/event-stream`, ping komentar tiap 20 dtk. Event pertama `snapshot` (kondisi kantor penuh).
Payload `ServerEvent` (`src/lib/types.ts`), `type`:

| type | Isi |
|---|---|
| `snapshot` | mode, agents, task aktif, cards, logs |
| `agent` | perubahan status/posisi/aktivitas agen |
| `bubble_start` / `bubble_delta` / `bubble_end` | bubble chat streaming di atas kepala agen |
| `log` | entri activity log |
| `card` | kartu kanban baru/pindah kolom |
| `output` | hasil kerja agen / rangkuman CEO |
| `task` | perubahan status tugas |

Dipakai: `connectEvents` → store `useOffice` → semua panel & canvas. EventSource reconnect otomatis.
