---
description: Sinkronkan Postman collection v2.1 + environment dari kode backend
argument-hint: "[endpoint yang berubah, opsional]"
---

# /postman $ARGUMENTS

## 1. Kumpulkan dari kode
1. Route: `grep -n "HandleFunc" backend/main.go`. Handler di `backend/main.go` (`func (a *API) ...`).
2. Untuk tiap route: method yang diterima, body (struct anonim / DTO), batas validasi, kode status & body error.
3. Semua route saat ini publik (tanpa auth). Catat bila ada yang berubah menjadi ber-auth.

## 2. Tulis `docs/postman/gustee-bakery-office.postman_collection.json` (schema v2.1)
- Folder per area (Sistem, Tugas, Data, Realtime). URL memakai `{{baseUrl}}`.
- Tiap request: deskripsi singkat (Indonesia), contoh body, **contoh respons sukses dan tiap error** (`response[]`).
- SSE `/api/events`: request GET dengan catatan bahwa Postman menampilkan stream; contoh event `snapshot`.
- Tanpa data asli atau secret; pakai data dari `backend/data/seed.json` sebagai contoh.

## 3. Environment `docs/postman/gustee-bakery-office.postman_environment.json`
Variabel `baseUrl` = `http://localhost:8080`. Tidak ada token.

## 4. Verifikasi
Validasi JSON (`jq . file >/dev/null`). Bila backend bisa dijalankan, cocokkan 1–2 respons dengan `curl`.
Sinkronkan juga `docs/api/`. Laporkan request yang ditambah/diubah. Jangan commit.
