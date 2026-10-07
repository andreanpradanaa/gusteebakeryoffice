package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"
)

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

// loadDotEnv membaca file .env sederhana (KEY=VALUE) bila ada, tanpa menimpa env yang sudah diset.
func loadDotEnv(path string) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k, v = strings.TrimSpace(k), strings.Trim(strings.TrimSpace(v), `"'`)
		if os.Getenv(k) == "" {
			os.Setenv(k, v)
		}
	}
}

func main() {
	loadDotEnv(".env")
	reseed := flag.Bool("reseed", false, "muat ulang data master dari data/seed.json")
	flag.Parse()

	addr := env("ADDR", ":8080")
	dbPath := env("DB_PATH", "gustee.db")
	seedPath := env("SEED_FILE", filepath.Join("data", "seed.json"))
	agentsDir := env("AGENTS_DIR", "agents")
	apiKey := env("ANTHROPIC_API_KEY", "")
	model := env("CLAUDE_MODEL", "claude-opus-5-5")
	effort := env("CLAUDE_EFFORT", "medium")
	fallbacks := env("CLAUDE_FALLBACKS", "on") != "off"
	// LLM_PROVIDER: anthropic (default) | openrouter
	provider := strings.ToLower(env("LLM_PROVIDER", "anthropic"))
	if provider == "openrouter" {
		apiKey = env("OPENROUTER_API_KEY", "")
		model = env("OPENROUTER_MODEL", "anthropic/claude-opus-5-5")
	}
	if env("DEMO_MODE", "") == "1" {
		apiKey = ""
	}

	store, err := OpenStore(dbPath)
	if err != nil {
		log.Fatalf("gagal membuka database: %v", err)
	}
	if *reseed || store.IsEmpty() {
		if err := store.Seed(seedPath); err != nil {
			log.Fatalf("gagal seed data: %v", err)
		}
		log.Printf("📦 Data contoh dimuat dari %s", seedPath)
	}
	store.MarkInterrupted()

	reg, err := LoadRegistry(agentsDir)
	if err != nil {
		log.Fatalf("gagal memuat agen: %v", err)
	}

	var llm *LLM
	mode := "demo"
	if apiKey != "" {
		if provider == "openrouter" {
			llm = NewOpenRouterLLM(apiKey, model)
		} else {
			llm = NewLLM(apiKey, model, effort, fallbacks)
		}
		mode = "llm"
	}
	hub := NewHub(store, reg, mode, model)
	orch := NewOrchestrator(hub, store, reg, llm)
	go orch.Loop()

	mux := http.NewServeMux()
	api := &API{store: store, hub: hub, orch: orch, reg: reg, model: model}
	mux.HandleFunc("/api/health", api.health)
	mux.HandleFunc("/api/events", api.events)
	mux.HandleFunc("/api/tasks", api.tasks)
	mux.HandleFunc("/api/agents", api.agents)
	mux.HandleFunc("/api/data/", api.data)

	// Sajikan hasil build frontend (npm run build) bila ada, agar cukup satu server di produksi.
	staticDir := env("STATIC_DIR", filepath.Join("..", "frontend", "dist"))
	if st, err := os.Stat(staticDir); err == nil && st.IsDir() {
		fs := http.FileServer(http.Dir(staticDir))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if _, err := os.Stat(filepath.Join(staticDir, filepath.Clean(r.URL.Path))); err != nil {
				http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
				return
			}
			fs.ServeHTTP(w, r)
		})
	}

	if mode == "llm" {
		log.Printf("🤖 Mode LLM aktif — provider %s, model %s, effort %s", provider, model, effort)
	} else {
		log.Printf("🧁 Mode DEMO (tanpa API key) — jawaban agen dibuat dari template + data database")
	}
	log.Printf("🥐 Gustee Bakery Office backend berjalan di http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, cors(mux)))
}

func cors(h http.Handler) http.Handler {
	origin := env("CORS_ORIGIN", "*")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

type API struct {
	store *Store
	hub   *Hub
	orch  *Orchestrator
	reg   *Registry
	model string
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (a *API) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{"ok": true, "mode": a.orch.Mode(), "model": a.model})
}

func (a *API) agents(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, a.reg.List)
}

// events: Server-Sent Events. Event pertama berisi snapshot kondisi kantor.
func (a *API) events(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming tidak didukung", 500)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch, unsub := a.hub.Subscribe()
	defer unsub()
	snap, _ := json.Marshal(Event{Type: "snapshot", Snapshot: a.hub.Snapshot(), Time: time.Now().UnixMilli()})
	fmt.Fprintf(w, "data: %s\n\n", snap)
	flusher.Flush()

	ping := time.NewTicker(20 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		case <-ping.C:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}

func (a *API) tasks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := a.store.ListTasks(50)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if list == nil {
			list = []*Task{}
		}
		writeJSON(w, 200, list)
	case http.MethodPost:
		var body struct {
			Prompt string `json:"prompt"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body); err != nil {
			writeJSON(w, 400, map[string]string{"error": "body tidak valid"})
			return
		}
		body.Prompt = strings.TrimSpace(body.Prompt)
		if body.Prompt == "" || utf8.RuneCountInString(body.Prompt) > 1000 {
			writeJSON(w, 400, map[string]string{"error": "perintah wajib diisi (maks 1000 karakter)"})
			return
		}
		t, err := a.orch.Submit(body.Prompt)
		if err != nil {
			writeJSON(w, 429, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 201, t)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (a *API) data(w http.ResponseWriter, r *http.Request) {
	b, err := a.store.LoadBakery()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	switch strings.TrimPrefix(r.URL.Path, "/api/data/") {
	case "products":
		type row struct {
			*Product
			HPP    float64 `json:"hpp"`
			Margin float64 `json:"margin"`
		}
		var out []row
		for _, id := range b.ProductOrder {
			out = append(out, row{b.Products[id], b.HPP(id), b.Margin(id)})
		}
		writeJSON(w, 200, out)
	case "ingredients":
		var out []*Ingredient
		for _, id := range b.IngredientOrder {
			out = append(out, b.Ingredients[id])
		}
		writeJSON(w, 200, out)
	case "recipes":
		type row struct {
			*Recipe
			BatchCost float64 `json:"batchCost"`
			UnitCost  float64 `json:"unitCost"`
		}
		var out []row
		for _, id := range b.RecipeOrder {
			out = append(out, row{b.Recipes[id], b.RecipeBatchCost(id), b.RecipeUnitCost(id)})
		}
		writeJSON(w, 200, out)
	case "sales":
		type prod struct {
			ID      string `json:"id"`
			Name    string `json:"name"`
			Qty     int64  `json:"qty"`
			Revenue int64  `json:"revenue"`
		}
		var top []prod
		for _, ps := range b.SalesByProduct() {
			top = append(top, prod{ps.Product.ID, ps.Product.Name, ps.Qty, ps.Revenue})
		}
		writeJSON(w, 200, map[string]any{"total": b.TotalRevenue(), "daily": b.DailyRevenue(), "byProduct": top})
	default:
		writeJSON(w, 404, map[string]string{"error": "tidak ditemukan"})
	}
}
