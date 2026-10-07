-- Skema SQLite Gustee Bakery Office
-- Sumber: konstanta schema di backend/db.go (diekstrak 2026-10-07). Jangan edit manual; ekstrak ulang bila db.go berubah.

CREATE TABLE IF NOT EXISTS ingredients (
	id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL,
	price REAL NOT NULL, stock REAL NOT NULL, min_stock REAL NOT NULL, supplier TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recipes (
	id TEXT PRIMARY KEY, name TEXT NOT NULL, yield REAL NOT NULL, yield_unit TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recipe_items (
	recipe_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, qty REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
	id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL,
	unit TEXT NOT NULL, recipe_id TEXT, base_daily_sales REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS product_bundle (
	product_id TEXT NOT NULL, item_product_id TEXT NOT NULL, qty REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sales (
	date TEXT NOT NULL, product_id TEXT NOT NULL, qty INTEGER NOT NULL, revenue INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
	id TEXT PRIMARY KEY, prompt TEXT NOT NULL, status TEXT NOT NULL, mode TEXT NOT NULL,
	created_at INTEGER NOT NULL, finished_at INTEGER, summary TEXT
);
CREATE TABLE IF NOT EXISTS outputs (
	id TEXT PRIMARY KEY, task_id TEXT NOT NULL, agent TEXT NOT NULL, title TEXT NOT NULL,
	content TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS logs (
	id TEXT PRIMARY KEY, task_id TEXT, from_agent TEXT NOT NULL, to_agent TEXT,
	text TEXT NOT NULL, kind TEXT NOT NULL, time INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS kanban (
	id TEXT PRIMARY KEY, task_id TEXT NOT NULL, title TEXT NOT NULL, agent TEXT NOT NULL,
	col TEXT NOT NULL, updated_at INTEGER NOT NULL
);
