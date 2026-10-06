# 🥐 Gustee Bakery Office

Kantor virtual interaktif bergaya game pixel-art (cozy, ala Stardew Valley) tempat **5 agen AI** bekerja sebagai tim manajemen Gustee Bakery. Beri perintah ke Owner CEO, lalu lihat tim berkumpul di ruang meeting, berjalan kembali ke ruangannya, mengetik/mengaduk adonan/mengecek gudang, saling bertanya, hingga CEO merangkum rencana akhir.

| Agen | Nama | Ruangan | Tugas |
|---|---|---|---|
| Owner CEO | Raka | Ruang Owner | Memecah perintah, membagi tugas, merangkum hasil |
| Marketing & Content | Nadia | Studio Konten | Strategi promo, caption IG/TikTok, ide Reels, jadwal posting |
| Finance | Bima | Kasir & Administrasi | Omzet, HPP, margin, harga jual |
| Recipe & R&D | Sari | Test Kitchen | Resep, scaling, costing, menu baru |
| Operations | Pak Joko | Dapur Produksi & Gudang | Rencana produksi, stok, daftar belanja |

## Fitur

- **Peta bakery** (canvas, tile map 44×32): ruang owner, studio konten, kasir, test kitchen, dapur produksi, gudang, ruang meeting, dan etalase toko dengan papan nama "Gustee Bakery".
- **Animasi**: karakter berjalan antar ruangan (pathfinding BFS), mengetik, mengaduk, menguleni, syuting, menghitung uang, mengecek rak gudang, dan berkumpul saat rapat. NPC pembeli & baker meramaikan toko/dapur.
- **Bubble chat streaming** di atas kepala agen (teks muncul bertahap).
- **Input tugas** di bawah peta + saran perintah cepat.
- **Activity log**: timeline perintah, pertanyaan & jawaban antar-agen (mis. *Finance → Recipe & R&D: berapa biaya bahan per toples nastar?*).
- **Klik karakter** → panel detail: profil, status, tugas saat ini, pesan terakhir, riwayat output.
- **Kanban** (To Do / In Progress / Review / Done) otomatis — juga tampil sebagai catatan tempel di papan dinding ruang meeting.
- **Hasil Kerja**: rencana akhir CEO + output tiap agen; bisa disalin atau diunduh `.md` (per output atau gabungan).
- **Tab Data**: omzet 30 hari, HPP & margin per produk, stok gudang (peringatan di bawah minimum).
- **Siklus pagi/siang/sore/malam** sesuai jam WIB (bisa di-override di header). Pagi dapur ramai, malam agen rekap.
- **Dark mode** (suasana bakery malam), **responsive** (peta bisa digeser/pinch-zoom, sidebar jadi bottom sheet di mobile).
- **Mode demo tanpa API key** — jawaban dibuat dari template + angka nyata yang dihitung dari database (HPP, kebutuhan bahan vs stok, proyeksi omzet).
- **Kantor bersama**: semua pengunjung melihat agen yang sama secara real-time (SSE).

## Struktur folder

```
AI Office/
├── README.md
├── backend/                     # Go — orkestrasi agen, API, SQLite
│   ├── main.go                  # server HTTP, routing, SSE, serve frontend build
│   ├── orchestrator.go          # alur CEO → rapat → agen paralel → review → rangkuman
│   ├── llm.go                   # Claude API (streaming, tool `tanya_agen`, structured output)
│   ├── mock.go                  # mode demo: jawaban template + angka dari DB
│   ├── hub.go                   # event bus realtime + state kantor (snapshot)
│   ├── agents.go                # registry agen dari agents/agents.json
│   ├── bakery.go                # perhitungan HPP, margin, kebutuhan bahan, konteks data per agen
│   ├── db.go                    # skema SQLite, seed, query
│   ├── agents/
│   │   ├── agents.json          # daftar agen (id, nama, role, ruangan, cakupan data)
│   │   └── prompts/             # system prompt Bahasa Indonesia per agen (+ _umum.md)
│   ├── data/seed.json           # data contoh: produk, resep, bahan & stok
│   ├── .env.example
│   └── go.mod
└── frontend/                    # React + TypeScript + Vite + Tailwind + Zustand
    ├── index.html
    ├── vite.config.ts           # proxy /api → backend :8080
    ├── tailwind.config.js       # palet krem, cokelat roti, peach, hijau pastel
    └── src/
        ├── App.tsx
        ├── config/agents.ts     # tampilan agen (warna, rambut, celemek, animasi, ambient)
        ├── game/
        │   ├── map.ts           # tile map, ruangan, furnitur, pathfinding
        │   ├── sprites.ts       # sprite pixel-art karakter (digambar via kode)
        │   ├── engine.ts        # pergerakan, animasi, NPC
        │   └── renderer.ts      # render canvas, pencahayaan siang/malam, bubble
        ├── components/          # Header, TaskInput, Sidebar, ActivityLog, KanbanBoard,
        │                        # ResultsPanel, DataPanel, AgentPanel, OfficeCanvas
        ├── store/useOffice.ts   # Zustand store (state dari event SSE)
        └── lib/                 # api, tipe, waktu WIB, markdown
```

Semua sprite & furnitur digambar lewat kode canvas — tidak ada file gambar eksternal.

## Persyaratan

- **Go 1.24+** (Anthropic Go SDK; driver SQLite pure-Go `modernc.org/sqlite`, tanpa CGO)
- **Node.js 20+** dan npm

## Cara install & menjalankan

```bash
# 1) Backend
cd backend
cp .env.example .env          # opsional: isi ANTHROPIC_API_KEY
go mod download               # unduh dependensi
go run .                      # server di http://localhost:8080
go test ./...                 # (opsional) uji HPP & template mode demo
```

```bash
# 2) Frontend (terminal lain)
cd frontend
npm install
npm run dev                   # buka http://localhost:5173
```

Saat pertama dijalankan, backend membuat `gustee.db` dan mengisinya dari `data/seed.json` (termasuk 30 hari penjualan yang di-generate dari `base_daily_sales`).

**Produksi / satu server:** `cd frontend && npm run build`, lalu `cd ../backend && go run .` — backend otomatis menyajikan `frontend/dist` di http://localhost:8080.

## Cara set API key

API key **hanya disimpan di backend** dan tidak pernah dikirim ke browser. Frontend hanya bicara ke `/api/*`.

1. Buat API key di https://console.anthropic.com
2. Di `backend/.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   CLAUDE_MODEL=claude-opus-5-5
   CLAUDE_EFFORT=medium      # low = lebih cepat & hemat, high = lebih teliti
   ```
   atau lewat environment: `ANTHROPIC_API_KEY=sk-ant-... go run .`
3. Restart backend. Badge di header berubah dari **Mode Demo** menjadi **Claude · claude-opus-5-5**.

Tanpa API key (atau `DEMO_MODE=1`), aplikasi berjalan di **mode demo**. Jika panggilan LLM gagal di tengah jalan (key salah, rate limit), agen otomatis memakai jawaban demo dan log menampilkan peringatan.

### Cara kerja orkestrasi (mode LLM)

1. **CEO** memecah perintah menjadi sub-tugas JSON (structured output) → kartu Kanban *To Do*.
2. Semua agen **rapat** di ruang meeting, CEO membagikan tugas (tercatat di Activity log).
3. Agen kembali ke ruangan dan **bekerja paralel** dengan respons streaming ke bubble chat.
4. Setiap agen hanya diberi data bidangnya (mis. Finance tidak memegang resep). Jika butuh data lain, agen memakai tool **`tanya_agen`** → karakternya berjalan ke ruangan rekan, rekan menjawab (streaming) dengan datanya sendiri, jawaban masuk sebagai hasil tool.
5. Hasil → kartu *Review* → CEO meninjau (*Done*) → CEO **merangkum** rencana akhir → panel Hasil Kerja.

## Cara mengubah data produk/resep

Edit `backend/data/seed.json`:

- `ingredients` — bahan & kemasan: `price` (Rp per satuan g/ml/butir/pcs), `stock`, `min_stock`, `supplier`.
- `recipes` — resep per batch: `yield` + `yield_unit`, dan `items` (`ingredient` id + `qty`). Kemasan boleh dimasukkan sebagai item resep.
- `products` — `price`, `category`, `unit`, `recipe` (id resep), `base_daily_sales` (dasar simulasi penjualan 30 hari), dan opsional `bundle` untuk hampers (isi produk lain).

HPP produk = biaya resep per unit + HPP isi bundle. Lalu muat ulang database:

```bash
cd backend
go run . -reseed      # data master & penjualan dimuat ulang; riwayat tugas tetap
```

(atau hapus `gustee.db` lalu jalankan ulang.) Data juga bisa dilihat lewat API: `/api/data/products`, `/api/data/recipes`, `/api/data/ingredients`, `/api/data/sales`.

## Cara menambah agen baru

Contoh: menambah **Customer Service** bernama "Dewi".

1. **Backend – registry** `backend/agents/agents.json`:
   ```json
   { "id": "cs", "name": "Dewi", "role": "Customer Service", "room": "shop",
     "promptFile": "cs.md", "dataScopes": ["katalog"], "worker": true }
   ```
   `dataScopes` yang tersedia: `katalog`, `resep`, `stok`, `penjualan`. `worker: true` berarti CEO bisa memberinya sub-tugas.
2. **Backend – prompt** `backend/agents/prompts/cs.md`: tulis peran, bidang, dan kepada siapa ia harus bertanya. Aturan umum tim ada di `_umum.md` (tambahkan juga baris agen baru di daftar tim di sana).
3. **Frontend – tampilan** `frontend/src/config/agents.ts`: tambahkan entri ke `AGENTS` dengan `id` yang sama, `home` (id ruangan dari `game/map.ts`), warna, rambut, celemek, aksesori, `workAnims`, dan kalimat `ambient`.
4. (Opsional) Tambah profil tanggung jawab di `PROFILE` pada `components/AgentPanel.tsx`, dan template demo di `backend/mock.go` (`mockWork`). Tanpa template, agen baru tetap tampil di mode demo dengan jawaban generik; di mode LLM ia langsung bekerja penuh.
5. Restart backend & frontend. Agen baru otomatis ikut rapat, mendapat kursi meeting, bisa ditanya agen lain via `tanya_agen`, dan muncul di Kanban.

Untuk menambah **ruangan** baru, tambahkan entri `ROOMS` (+ pintu di `DOORS`, furnitur di `FURNITURE`) di `frontend/src/game/map.ts`.

## API

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/health` | mode (`demo`/`llm`) & model |
| GET | `/api/events` | SSE: snapshot + event realtime (agent, bubble, log, card, output, task) |
| POST | `/api/tasks` | `{ "prompt": "Siapkan promo hampers Lebaran." }` |
| GET | `/api/tasks` | riwayat tugas + output |
| GET | `/api/agents` | daftar agen |
| GET | `/api/data/{products,recipes,ingredients,sales}` | data bakery |

## Konfigurasi lain (env backend)

| Variabel | Default | Keterangan |
|---|---|---|
| `ADDR` | `:8080` | alamat server |
| `DB_PATH` | `gustee.db` | file SQLite |
| `SEED_FILE` | `data/seed.json` | sumber data contoh |
| `AGENTS_DIR` | `agents` | folder registry & prompt agen |
| `CLAUDE_FALLBACKS` | `on` | fallback model otomatis di sisi server bila permintaan ditolak classifier |
| `STATIC_DIR` | `../frontend/dist` | build frontend yang disajikan backend |
| `CORS_ORIGIN` | `*` | batasi origin bila backend diakses langsung |

Frontend: `VITE_API_URL` (default kosong = pakai proxy Vite) dan `BACKEND_URL` untuk target proxy dev — mis. jika port 8080 sudah dipakai: `ADDR=:8787 go run .` lalu `BACKEND_URL=http://localhost:8787 npm run dev`.
