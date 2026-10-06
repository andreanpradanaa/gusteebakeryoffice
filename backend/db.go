package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"time"

	_ "modernc.org/sqlite"
)

const schema = `
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
`

type Store struct{ db *sql.DB }

func OpenStore(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("schema: %w", err)
	}
	return &Store{db: db}, nil
}

// ---------- Seed ----------

type seedFile struct {
	Ingredients []Ingredient `json:"ingredients"`
	Recipes     []struct {
		ID        string  `json:"id"`
		Name      string  `json:"name"`
		Yield     float64 `json:"yield"`
		YieldUnit string  `json:"yield_unit"`
		Items     []struct {
			Ingredient string  `json:"ingredient"`
			Qty        float64 `json:"qty"`
		} `json:"items"`
	} `json:"recipes"`
	Products []struct {
		ID             string  `json:"id"`
		Name           string  `json:"name"`
		Category       string  `json:"category"`
		Price          int64   `json:"price"`
		Unit           string  `json:"unit"`
		Recipe         string  `json:"recipe"`
		BaseDailySales float64 `json:"base_daily_sales"`
		Bundle         []struct {
			Product string  `json:"product"`
			Qty     float64 `json:"qty"`
		} `json:"bundle"`
	} `json:"products"`
}

func (s *Store) IsEmpty() bool {
	var n int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&n)
	return n == 0
}

// Seed menghapus data master (produk, resep, stok, penjualan) lalu memuat ulang dari file JSON.
// Riwayat tugas, log, dan kanban tidak ikut dihapus.
func (s *Store) Seed(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var sf seedFile
	if err := json.Unmarshal(raw, &sf); err != nil {
		return fmt.Errorf("seed.json tidak valid: %w", err)
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, t := range []string{"ingredients", "recipes", "recipe_items", "products", "product_bundle", "sales"} {
		if _, err := tx.Exec("DELETE FROM " + t); err != nil {
			return err
		}
	}
	for _, i := range sf.Ingredients {
		if _, err := tx.Exec(`INSERT INTO ingredients VALUES (?,?,?,?,?,?,?)`, i.ID, i.Name, i.Unit, i.Price, i.Stock, i.MinStock, i.Supplier); err != nil {
			return err
		}
	}
	for _, r := range sf.Recipes {
		if _, err := tx.Exec(`INSERT INTO recipes VALUES (?,?,?,?)`, r.ID, r.Name, r.Yield, r.YieldUnit); err != nil {
			return err
		}
		for _, it := range r.Items {
			if _, err := tx.Exec(`INSERT INTO recipe_items VALUES (?,?,?)`, r.ID, it.Ingredient, it.Qty); err != nil {
				return err
			}
		}
	}
	for _, p := range sf.Products {
		if _, err := tx.Exec(`INSERT INTO products VALUES (?,?,?,?,?,?,?)`, p.ID, p.Name, p.Category, p.Price, p.Unit, p.Recipe, p.BaseDailySales); err != nil {
			return err
		}
		for _, b := range p.Bundle {
			if _, err := tx.Exec(`INSERT INTO product_bundle VALUES (?,?,?)`, p.ID, b.Product, b.Qty); err != nil {
				return err
			}
		}
	}
	// Penjualan 30 hari terakhir dibuat deterministik dari base_daily_sales:
	// akhir pekan lebih ramai (x1.45), Jumat x1.15, plus variasi acak ±25%.
	rng := newLCG(20260101)
	today := time.Now().In(wib)
	for d := 30; d >= 1; d-- {
		day := today.AddDate(0, 0, -d)
		mult := 1.0
		switch day.Weekday() {
		case time.Saturday, time.Sunday:
			mult = 1.45
		case time.Friday:
			mult = 1.15
		}
		trend := 0.9 + 0.2*float64(30-d)/30 // tren naik pelan
		for _, p := range sf.Products {
			q := p.BaseDailySales * mult * trend * (0.75 + 0.5*rng.next())
			qty := int64(math.Round(q))
			if qty <= 0 {
				continue
			}
			if _, err := tx.Exec(`INSERT INTO sales VALUES (?,?,?,?)`, day.Format("2006-01-02"), p.ID, qty, qty*p.Price); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

type lcg struct{ s uint64 }

func newLCG(seed uint64) *lcg { return &lcg{s: seed} }
func (l *lcg) next() float64 {
	l.s = l.s*6364136223846793005 + 1442695040888963407
	return float64(l.s>>11) / float64(1<<53)
}

// ---------- Master data ----------

type Ingredient struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Unit     string  `json:"unit"`
	Price    float64 `json:"price"`
	Stock    float64 `json:"stock"`
	MinStock float64 `json:"min_stock"`
	Supplier string  `json:"supplier"`
}

type RecipeItem struct {
	IngredientID string  `json:"ingredient"`
	Qty          float64 `json:"qty"`
}

type Recipe struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Yield     float64      `json:"yield"`
	YieldUnit string       `json:"yield_unit"`
	Items     []RecipeItem `json:"items"`
}

type BundleItem struct {
	ProductID string  `json:"product"`
	Qty       float64 `json:"qty"`
}

type Product struct {
	ID             string       `json:"id"`
	Name           string       `json:"name"`
	Category       string       `json:"category"`
	Price          int64        `json:"price"`
	Unit           string       `json:"unit"`
	RecipeID       string       `json:"recipe"`
	BaseDailySales float64      `json:"base_daily_sales"`
	Bundle         []BundleItem `json:"bundle,omitempty"`
}

type SaleRow struct {
	Date      string `json:"date"`
	ProductID string `json:"product"`
	Qty       int64  `json:"qty"`
	Revenue   int64  `json:"revenue"`
}

func (s *Store) LoadBakery() (*Bakery, error) {
	b := &Bakery{Ingredients: map[string]*Ingredient{}, Recipes: map[string]*Recipe{}, Products: map[string]*Product{}}
	rows, err := s.db.Query(`SELECT id,name,unit,price,stock,min_stock,supplier FROM ingredients ORDER BY rowid`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		i := &Ingredient{}
		if err := rows.Scan(&i.ID, &i.Name, &i.Unit, &i.Price, &i.Stock, &i.MinStock, &i.Supplier); err != nil {
			rows.Close()
			return nil, err
		}
		b.Ingredients[i.ID] = i
		b.IngredientOrder = append(b.IngredientOrder, i.ID)
	}
	rows.Close()

	rows, err = s.db.Query(`SELECT id,name,yield,yield_unit FROM recipes ORDER BY rowid`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		r := &Recipe{}
		if err := rows.Scan(&r.ID, &r.Name, &r.Yield, &r.YieldUnit); err != nil {
			rows.Close()
			return nil, err
		}
		b.Recipes[r.ID] = r
		b.RecipeOrder = append(b.RecipeOrder, r.ID)
	}
	rows.Close()
	rows, err = s.db.Query(`SELECT recipe_id, ingredient_id, qty FROM recipe_items ORDER BY rowid`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var rid string
		var it RecipeItem
		if err := rows.Scan(&rid, &it.IngredientID, &it.Qty); err != nil {
			rows.Close()
			return nil, err
		}
		if r := b.Recipes[rid]; r != nil {
			r.Items = append(r.Items, it)
		}
	}
	rows.Close()

	rows, err = s.db.Query(`SELECT id,name,category,price,unit,COALESCE(recipe_id,''),base_daily_sales FROM products ORDER BY rowid`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		p := &Product{}
		if err := rows.Scan(&p.ID, &p.Name, &p.Category, &p.Price, &p.Unit, &p.RecipeID, &p.BaseDailySales); err != nil {
			rows.Close()
			return nil, err
		}
		b.Products[p.ID] = p
		b.ProductOrder = append(b.ProductOrder, p.ID)
	}
	rows.Close()
	rows, err = s.db.Query(`SELECT product_id,item_product_id,qty FROM product_bundle ORDER BY rowid`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var pid string
		var bi BundleItem
		if err := rows.Scan(&pid, &bi.ProductID, &bi.Qty); err != nil {
			rows.Close()
			return nil, err
		}
		if p := b.Products[pid]; p != nil {
			p.Bundle = append(p.Bundle, bi)
		}
	}
	rows.Close()

	rows, err = s.db.Query(`SELECT date,product_id,qty,revenue FROM sales ORDER BY date`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var r SaleRow
		if err := rows.Scan(&r.Date, &r.ProductID, &r.Qty, &r.Revenue); err != nil {
			rows.Close()
			return nil, err
		}
		b.Sales = append(b.Sales, r)
	}
	rows.Close()
	return b, nil
}

// ---------- Tasks, outputs, logs, kanban ----------

type Task struct {
	ID         string    `json:"id"`
	Prompt     string    `json:"prompt"`
	Status     string    `json:"status"`
	Mode       string    `json:"mode"`
	CreatedAt  int64     `json:"createdAt"`
	FinishedAt int64     `json:"finishedAt,omitempty"`
	Summary    string    `json:"summary,omitempty"`
	Outputs    []*Output `json:"outputs"`
}

type Output struct {
	ID        string `json:"id"`
	TaskID    string `json:"taskId"`
	Agent     string `json:"agent"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	CreatedAt int64  `json:"createdAt"`
}

type LogEntry struct {
	ID     string `json:"id"`
	TaskID string `json:"taskId,omitempty"`
	From   string `json:"from"`
	To     string `json:"to,omitempty"`
	Text   string `json:"text"`
	Kind   string `json:"kind"` // perintah | pesan | tanya | jawab | sistem | hasil
	Time   int64  `json:"time"`
}

type KanbanCard struct {
	ID        string `json:"id"`
	TaskID    string `json:"taskId"`
	Title     string `json:"title"`
	Agent     string `json:"agent"`
	Column    string `json:"column"` // todo | progress | review | done
	UpdatedAt int64  `json:"updatedAt"`
}

func (s *Store) CreateTask(t *Task) error {
	_, err := s.db.Exec(`INSERT INTO tasks (id,prompt,status,mode,created_at) VALUES (?,?,?,?,?)`, t.ID, t.Prompt, t.Status, t.Mode, t.CreatedAt)
	return err
}

func (s *Store) UpdateTaskStatus(id, status string) {
	_, _ = s.db.Exec(`UPDATE tasks SET status=? WHERE id=?`, status, id)
}

func (s *Store) FinishTask(id, status, summary string) {
	_, _ = s.db.Exec(`UPDATE tasks SET status=?, summary=?, finished_at=? WHERE id=?`, status, summary, time.Now().UnixMilli(), id)
}

func (s *Store) SaveOutput(o *Output) {
	_, _ = s.db.Exec(`INSERT OR REPLACE INTO outputs VALUES (?,?,?,?,?,?)`, o.ID, o.TaskID, o.Agent, o.Title, o.Content, o.CreatedAt)
}

func (s *Store) SaveLog(l *LogEntry) {
	_, _ = s.db.Exec(`INSERT OR REPLACE INTO logs VALUES (?,?,?,?,?,?,?)`, l.ID, l.TaskID, l.From, l.To, l.Text, l.Kind, l.Time)
}

func (s *Store) SaveCard(c *KanbanCard) {
	_, _ = s.db.Exec(`INSERT OR REPLACE INTO kanban VALUES (?,?,?,?,?,?)`, c.ID, c.TaskID, c.Title, c.Agent, c.Column, c.UpdatedAt)
}

func (s *Store) ListTasks(limit int) ([]*Task, error) {
	rows, err := s.db.Query(`SELECT id,prompt,status,mode,created_at,COALESCE(finished_at,0),COALESCE(summary,'') FROM tasks ORDER BY created_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Task
	byID := map[string]*Task{}
	for rows.Next() {
		t := &Task{Outputs: []*Output{}}
		if err := rows.Scan(&t.ID, &t.Prompt, &t.Status, &t.Mode, &t.CreatedAt, &t.FinishedAt, &t.Summary); err != nil {
			return nil, err
		}
		out = append(out, t)
		byID[t.ID] = t
	}
	rows.Close()
	orows, err := s.db.Query(`SELECT id,task_id,agent,title,content,created_at FROM outputs ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer orows.Close()
	for orows.Next() {
		o := &Output{}
		if err := orows.Scan(&o.ID, &o.TaskID, &o.Agent, &o.Title, &o.Content, &o.CreatedAt); err != nil {
			return nil, err
		}
		if t := byID[o.TaskID]; t != nil {
			t.Outputs = append(t.Outputs, o)
		}
	}
	return out, nil
}

func (s *Store) RecentLogs(limit int) []*LogEntry {
	rows, err := s.db.Query(`SELECT id,COALESCE(task_id,''),from_agent,COALESCE(to_agent,''),text,kind,time FROM logs ORDER BY time DESC LIMIT ?`, limit)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []*LogEntry
	for rows.Next() {
		l := &LogEntry{}
		if rows.Scan(&l.ID, &l.TaskID, &l.From, &l.To, &l.Text, &l.Kind, &l.Time) == nil {
			out = append(out, l)
		}
	}
	// balik urutan → kronologis
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}

func (s *Store) RecentCards(limit int) []*KanbanCard {
	rows, err := s.db.Query(`SELECT id,task_id,title,agent,col,updated_at FROM kanban ORDER BY updated_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []*KanbanCard
	for rows.Next() {
		c := &KanbanCard{}
		if rows.Scan(&c.ID, &c.TaskID, &c.Title, &c.Agent, &c.Column, &c.UpdatedAt) == nil {
			out = append(out, c)
		}
	}
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}

// Tugas yang terputus (mis. server mati di tengah jalan) ditandai gagal saat start.
func (s *Store) MarkInterrupted() {
	_, _ = s.db.Exec(`UPDATE tasks SET status='gagal', summary='Terhenti karena server dimatikan.' WHERE status IN ('antre','berjalan')`)
	_, _ = s.db.Exec(`UPDATE kanban SET col='done' WHERE col!='done'`)
}
