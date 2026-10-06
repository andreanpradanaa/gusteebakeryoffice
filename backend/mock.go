package main

// Mode demo: jawaban agen dibuat dari template + angka NYATA yang dihitung dari database
// (HPP, stok, penjualan), sehingga tetap masuk akal tanpa API key.

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

type mockConsult struct {
	To       string
	Question string
	Answer   string
}

type mockResult struct {
	Consults []mockConsult
	Text     string
}

// ---------- Analisis skenario dari perintah owner ----------

type scenario struct {
	Occasion  string // "Lebaran", "Natal", "Imlek", "Valentine", "" (umum)
	EventDate time.Time
	Focus     []*Product
	Target    map[string]float64
	IsHampers bool
	Today     time.Time
}

var seasonDates = map[string][]string{
	"Lebaran":   {"2026-03-20", "2027-03-10", "2028-02-27", "2029-02-15"},
	"Imlek":     {"2026-02-17", "2027-02-06", "2028-01-26", "2029-02-13"},
	"Natal":     {"2026-12-25", "2027-12-25", "2028-12-25", "2029-12-25"},
	"Valentine": {"2026-02-14", "2027-02-14", "2028-02-14", "2029-02-14"},
}

func nextSeason(name string, today time.Time) time.Time {
	for _, d := range seasonDates[name] {
		t, _ := time.ParseInLocation("2006-01-02", d, wib)
		if !t.Before(today) {
			return t
		}
	}
	return today.AddDate(0, 1, 0)
}

func analyze(prompt string, b *Bakery) *scenario {
	p := strings.ToLower(prompt)
	today := time.Now().In(wib).Truncate(24 * time.Hour)
	sc := &scenario{Target: map[string]float64{}, Today: today}
	has := func(words ...string) bool {
		for _, w := range words {
			if strings.Contains(p, w) {
				return true
			}
		}
		return false
	}
	switch {
	case has("lebaran", "idul fitri", "idulfitri", "ramadan", "ramadhan", "mudik"):
		sc.Occasion = "Lebaran"
	case has("natal", "christmas", "xmas"):
		sc.Occasion = "Natal"
	case has("imlek", "cny", "chinese new year", "sincia"):
		sc.Occasion = "Imlek"
	case has("valentine", "kasih sayang"):
		sc.Occasion = "Valentine"
	}
	if sc.Occasion == "" && has("hampers", "parcel", "parsel") {
		// pilih musim terdekat
		best := ""
		var bestDate time.Time
		for _, s := range []string{"Natal", "Imlek", "Lebaran"} {
			d := nextSeason(s, today)
			if best == "" || d.Before(bestDate) {
				best, bestDate = s, d
			}
		}
		sc.Occasion = best
	}
	if sc.Occasion != "" {
		sc.EventDate = nextSeason(sc.Occasion, today)
	}

	hampersFor := map[string]string{"Lebaran": "hampers_lebaran", "Natal": "hampers_natal", "Imlek": "hampers_imlek"}
	if id, ok := hampersFor[sc.Occasion]; ok && b.Products[id] != nil && (has("hampers", "parcel", "parsel", "paket", "bingkisan") || !matchesAnyProduct(p, b)) {
		sc.Focus = []*Product{b.Products[id]}
		sc.IsHampers = true
	}
	if len(sc.Focus) == 0 {
		for _, id := range b.ProductOrder {
			pr := b.Products[id]
			if pr.Category != "Hampers" && productMentioned(p, pr) {
				sc.Focus = append(sc.Focus, pr)
			}
		}
	}
	if len(sc.Focus) == 0 && sc.Occasion == "Valentine" {
		for _, id := range []string{"red_velvet", "choco_cookies"} {
			if b.Products[id] != nil {
				sc.Focus = append(sc.Focus, b.Products[id])
			}
		}
	}
	if len(sc.Focus) == 0 {
		for _, ps := range b.SalesByProduct() {
			if ps.Product.Category != "Hampers" {
				sc.Focus = append(sc.Focus, ps.Product)
			}
			if len(sc.Focus) == 2 {
				break
			}
		}
	}
	if len(sc.Focus) > 3 {
		sc.Focus = sc.Focus[:3]
	}
	// Target produksi: hampers 120 box; produk lain = rata-rata harian × 14 hari × 1,3 (uplift promo).
	daily := map[string]float64{}
	days := float64(len(b.DailyRevenue()))
	if days == 0 {
		days = 30
	}
	for _, ps := range b.SalesByProduct() {
		daily[ps.Product.ID] = float64(ps.Qty) / days
	}
	for _, f := range sc.Focus {
		if sc.IsHampers {
			sc.Target[f.ID] = 120
		} else {
			sc.Target[f.ID] = math.Ceil(math.Max(daily[f.ID], f.BaseDailySales)*14*1.3/5) * 5
		}
	}
	return sc
}

func productAliases(pr *Product) []string {
	stop := map[string]bool{"roti": true, "cake": true, "premium": true, "hampers": true, "keju": true, "butter": true, "custom": true, "choco": true, "red": true}
	name := strings.ToLower(pr.Name)
	al := []string{name, strings.ReplaceAll(pr.ID, "_", " ")}
	if f := strings.Fields(name); len(f) > 0 && len(f[0]) >= 5 && !stop[f[0]] {
		al = append(al, f[0])
	}
	if f := strings.Fields(name); len(f) > 1 {
		al = append(al, f[0]+" "+f[1])
	}
	return al
}

func productMentioned(p string, pr *Product) bool {
	for _, a := range productAliases(pr) {
		if a != "" && strings.Contains(p, a) {
			return true
		}
	}
	return false
}

func matchesAnyProduct(p string, b *Bakery) bool {
	for _, id := range b.ProductOrder {
		if pr := b.Products[id]; pr.Category != "Hampers" && productMentioned(p, pr) {
			return true
		}
	}
	return false
}

func (sc *scenario) focusNames() string {
	var n []string
	for _, f := range sc.Focus {
		n = append(n, f.Name)
	}
	return strings.Join(n, " & ")
}

func (sc *scenario) title() string {
	if sc.Occasion != "" {
		if sc.IsHampers {
			return "Promo " + sc.Focus[0].Name
		}
		return "Promo " + sc.Occasion + " " + sc.focusNames()
	}
	return "Promo " + sc.focusNames()
}

func fmtDate(t time.Time) string {
	bulan := []string{"", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"}
	return fmt.Sprintf("%d %s %d", t.Day(), bulan[t.Month()], t.Year())
}

// timeline kampanye relatif terhadap tanggal event (atau 14 hari dari sekarang untuk promo umum).
type timeline struct {
	PreOrderOpen, EarlyBirdEnd, ProdStart, LastDelivery, End time.Time
}

func (sc *scenario) timeline() timeline {
	if sc.Occasion == "" {
		start := sc.Today.AddDate(0, 0, 2)
		return timeline{PreOrderOpen: start, EarlyBirdEnd: start.AddDate(0, 0, 3), ProdStart: start, LastDelivery: start.AddDate(0, 0, 13), End: start.AddDate(0, 0, 13)}
	}
	ev := sc.EventDate
	tl := timeline{PreOrderOpen: ev.AddDate(0, 0, -35), EarlyBirdEnd: ev.AddDate(0, 0, -24), ProdStart: ev.AddDate(0, 0, -18), LastDelivery: ev.AddDate(0, 0, -3), End: ev}
	if tl.PreOrderOpen.Before(sc.Today) {
		tl.PreOrderOpen = sc.Today.AddDate(0, 0, 1)
	}
	if !tl.EarlyBirdEnd.After(tl.PreOrderOpen) {
		tl.EarlyBirdEnd = tl.PreOrderOpen.AddDate(0, 0, 4)
	}
	if tl.ProdStart.Before(tl.PreOrderOpen) {
		tl.ProdStart = tl.PreOrderOpen
	}
	return tl
}

// ---------- Kalkulasi bersama ----------

type finance struct {
	Product     *Product
	Material    float64 // biaya bahan+kemasan per unit
	HPP         float64 // + overhead 15%
	Price       float64
	Margin      float64
	RecPrice    float64
	RecMargin   float64
	EBPrice     float64
	EBMargin    float64
	Target      float64
	Revenue     float64
	GrossProfit float64
}

const overheadPct = 0.15

func (sc *scenario) finances(b *Bakery) []finance {
	var out []finance
	for _, p := range sc.Focus {
		f := finance{Product: p, Material: b.HPP(p.ID), Price: float64(p.Price), Target: sc.Target[p.ID]}
		f.HPP = f.Material * (1 + overheadPct)
		f.Margin = (f.Price - f.HPP) / f.Price
		target := 0.55
		if p.Category == "Roti" || p.Category == "Pastry" {
			target = 0.50
		}
		f.RecPrice = f.Price
		if f.Margin < target {
			f.RecPrice = roundUp(f.HPP/(1-target), 1000)
		}
		f.RecMargin = (f.RecPrice - f.HPP) / f.RecPrice
		f.EBPrice = roundUp(f.RecPrice*0.9, 1000)
		f.EBMargin = (f.EBPrice - f.HPP) / f.EBPrice
		// asumsi 40% pesanan masuk saat early bird
		f.Revenue = f.Target * (0.4*f.EBPrice + 0.6*f.RecPrice)
		f.GrossProfit = f.Revenue - f.Target*f.HPP
		out = append(out, f)
	}
	return out
}

type buyItem struct {
	Ing       *Ingredient
	Need, Buy float64
	Cost      float64
}

func packSize(unit string) float64 {
	switch unit {
	case "g", "ml":
		return 1000
	case "butir":
		return 30
	default:
		return 10
	}
}

func (sc *scenario) needs(b *Bakery) (map[string]float64, map[string]float64, []buyItem) {
	need := map[string]float64{}
	batches := map[string]float64{}
	for _, f := range sc.Focus {
		b.IngredientNeeds(f.ID, sc.Target[f.ID], need, batches)
	}
	var buys []buyItem
	for _, id := range b.IngredientOrder {
		n, ok := need[id]
		if !ok {
			continue
		}
		ing := b.Ingredients[id]
		short := n + ing.MinStock - ing.Stock
		bi := buyItem{Ing: ing, Need: n}
		if short > 0 {
			ps := packSize(ing.Unit)
			bi.Buy = math.Ceil(short/ps) * ps
			bi.Cost = bi.Buy * ing.Price
		}
		buys = append(buys, bi)
	}
	return need, batches, buys
}

// packagingOnly: resep yang isinya hanya kemasan (mis. box hampers) bukan batch produksi.
func packagingOnly(b *Bakery, recipeID string) bool {
	r := b.Recipes[recipeID]
	if r == nil {
		return true
	}
	for _, it := range r.Items {
		if ing := b.Ingredients[it.IngredientID]; ing != nil && ing.Unit != "pcs" {
			return false
		}
	}
	return true
}

func totalBuy(buys []buyItem) float64 {
	t := 0.0
	for _, x := range buys {
		t += x.Cost
	}
	return t
}

// ---------- Rencana CEO ----------

func mockPlan(prompt string, b *Bakery, reg *Registry) *Plan {
	sc := analyze(prompt, b)
	names := sc.focusNames()
	tl := sc.timeline()
	p := &Plan{
		Pembuka: fmt.Sprintf("Oke tim, fokus kita: %s. Pre-order dibuka %s. Sari & Pak Joko mulai dari resep dan stok, Bima hitung harga, Nadia siapkan kontennya. Saling tanya kalau butuh data ya!", sc.title(), fmtDate(tl.PreOrderOpen)),
	}
	tasks := map[string]Subtask{
		"rnd": {Agent: "rnd", Judul: "Isi produk & costing resep",
			Instruksi: fmt.Sprintf("Tetapkan komposisi %s, hitung biaya bahan per unit, dan usulkan 1–2 varian baru. Kirim angka biaya ke Finance.", names)},
		"ops": {Agent: "ops", Judul: "Cek stok & jadwal produksi",
			Instruksi: "Hitung kebutuhan bahan & kemasan untuk target produksi, bandingkan dengan stok gudang, buat daftar belanja per supplier dan jadwal produksi. Minta jumlah batch ke R&D."},
		"finance": {Agent: "finance", Judul: "HPP, harga jual & margin",
			Instruksi: "Hitung HPP (minta biaya bahan ke R&D), tentukan harga jual & harga early bird yang aman untuk margin, serta proyeksi omzet dan laba kotor."},
		"marketing": {Agent: "marketing", Judul: "Strategi promo & konten",
			Instruksi: "Susun strategi promo, 3 caption IG/TikTok, ide Reels, dan jadwal posting. Konfirmasi harga & diskon ke Finance."},
	}
	for _, w := range reg.Workers() {
		if st, ok := tasks[w.ID]; ok {
			p.Subtasks = append(p.Subtasks, st)
		} else {
			p.Subtasks = append(p.Subtasks, Subtask{Agent: w.ID, Judul: "Dukungan " + w.Role, Instruksi: "Berikan masukan sesuai bidangmu untuk " + sc.title() + "."})
		}
	}
	return p
}

// ---------- Hasil kerja tiap agen ----------

func mockWork(agent, prompt string, b *Bakery, reg *Registry) mockResult {
	sc := analyze(prompt, b)
	switch agent {
	case "rnd":
		return mockRnD(sc, b)
	case "ops":
		return mockOps(sc, b)
	case "finance":
		return mockFinance(sc, b)
	case "marketing":
		return mockMarketing(sc, b)
	}
	a := reg.ByID[agent]
	role := agent
	if a != nil {
		role = a.Role
	}
	return mockResult{Text: fmt.Sprintf("## Masukan %s\n\n- Mendukung %s sesuai bidang %s.\n- (Mode demo: agen baru ini belum punya template jawaban. Pasang API key agar agen menjawab dengan LLM.)", role, sc.title(), role)}
}

func mockRnD(sc *scenario, b *Bakery) mockResult {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Komposisi & Costing — %s\n\n", sc.focusNames()))
	for _, f := range sc.Focus {
		if len(f.Bundle) > 0 {
			sb.WriteString(fmt.Sprintf("**Isi %s (1 %s):**\n\n| Komponen | Qty | Biaya bahan/unit | Subtotal |\n|---|---|---|---|\n", f.Name, f.Unit))
			for _, bi := range f.Bundle {
				bp := b.Products[bi.ProductID]
				c := b.HPP(bi.ProductID)
				sb.WriteString(fmt.Sprintf("| %s (%s) | %s | %s | %s |\n", bp.Name, bp.Unit, num(bi.Qty), rupiah(c), rupiah(c*bi.Qty)))
			}
			pc := b.RecipeUnitCost(f.RecipeID)
			sb.WriteString(fmt.Sprintf("| Box hampers + kartu & pita | 1 | %s | %s |\n", rupiah(pc), rupiah(pc)))
			sb.WriteString(fmt.Sprintf("| **Total biaya bahan & kemasan** | | | **%s** |\n\n", rupiah(b.HPP(f.ID))))
		} else {
			r := b.Recipes[f.RecipeID]
			sb.WriteString(fmt.Sprintf("**%s** — 1 batch = %s %s · biaya batch %s · **biaya per %s %s**\n\n", f.Name, num(r.Yield), r.YieldUnit, rupiah(b.RecipeBatchCost(r.ID)), f.Unit, rupiah(b.RecipeUnitCost(r.ID))))
		}
	}
	// bahan termahal
	main := sc.Focus[0]
	rid := main.RecipeID
	if len(main.Bundle) > 0 {
		rid = b.Products[main.Bundle[0].ProductID].RecipeID
	}
	if r := b.Recipes[rid]; r != nil {
		type c struct {
			n string
			v float64
		}
		var cs []c
		for _, it := range r.Items {
			ing := b.Ingredients[it.IngredientID]
			cs = append(cs, c{fmt.Sprintf("%s %s %s", ing.Name, num(it.Qty), ing.Unit), ing.Price * it.Qty})
		}
		sort.Slice(cs, func(i, j int) bool { return cs[i].v > cs[j].v })
		sb.WriteString(fmt.Sprintf("**Bahan paling berpengaruh di %s (per batch):** ", r.Name))
		var parts []string
		for i := 0; i < len(cs) && i < 3; i++ {
			parts = append(parts, fmt.Sprintf("%s (%s)", cs[i].n, rupiah(cs[i].v)))
		}
		sb.WriteString(strings.Join(parts, ", ") + ". Kualitas butter & selai/keju menentukan rasa, jadi tidak saya sarankan diganti.\n\n")
	}
	sb.WriteString("## Usulan Varian Baru\n")
	switch sc.Occasion {
	case "Lebaran":
		edam := b.Ingredients["keju_edam"]
		extra := 0.0
		if edam != nil {
			extra = 60 * edam.Price
		}
		sb.WriteString(fmt.Sprintf("1. **Nastar Keju Edam** — nastar klasik dengan taburan edam 60g/toples. Tambahan biaya ±%s/toples, cocok jadi pilihan premium.\n", rupiah(extra)))
		sb.WriteString("2. **Hampers Mini Silaturahmi** — 2 toples 250g (nastar + kastengel) untuk kolega/kantor, biaya ±55% versi reguler.\n")
	case "Natal":
		sb.WriteString("1. **Snowball Matcha** — putri salju varian matcha, warna hijau-putih khas Natal (tambahan ±Rp4.000/toples).\n")
		sb.WriteString("2. **Mini Choco Log** — bolu gulung cokelat 12cm untuk add-on hampers (biaya ±Rp32.000/pcs).\n")
	case "Imlek":
		sb.WriteString("1. **Nastar Jeruk Mandarin** — selai nanas + kulit jeruk, simbol keberuntungan (tambahan ±Rp3.500/toples).\n")
		sb.WriteString("2. **Kue Keranjang Panggang** — kemasan merah-emas untuk add-on (biaya ±Rp28.000/pcs).\n")
	case "Valentine":
		sb.WriteString("1. **Red Velvet Bento 10cm** — porsi berdua, biaya bahan ±30% dari cake 20cm.\n")
		sb.WriteString("2. **Heart Choco Cookies** — choco chip bentuk hati, kemasan pouch pink.\n")
	default:
		sb.WriteString(fmt.Sprintf("1. **%s varian isi baru** (mis. cokelat-keju) untuk menjaga rasa penasaran pelanggan.\n", sc.Focus[0].Name))
		sb.WriteString("2. **Paket Sarapan** — 1 roti + 1 pastry dalam paper box, memanfaatkan bahan yang sama.\n")
	}
	return mockResult{Text: sb.String()}
}

func mockOps(sc *scenario, b *Bakery) mockResult {
	_, batches, buys := sc.needs(b)
	tl := sc.timeline()
	var q strings.Builder
	for i, f := range sc.Focus {
		if i > 0 {
			q.WriteString(", ")
		}
		q.WriteString(fmt.Sprintf("%s %s %s", num(sc.Target[f.ID]), f.Unit, f.Name))
	}
	var ans strings.Builder
	ans.WriteString("Untuk " + q.String() + " butuh: ")
	var bl []string
	var totalBatch float64
	var rids []string
	for id := range batches {
		if !packagingOnly(b, id) {
			rids = append(rids, id)
		}
	}
	sort.Strings(rids)
	for _, id := range rids {
		nb := math.Ceil(batches[id])
		totalBatch += nb
		bl = append(bl, fmt.Sprintf("%s %s batch", b.Recipes[id].Name, num(nb)))
	}
	ans.WriteString(strings.Join(bl, ", ") + ".")
	res := mockResult{Consults: []mockConsult{{To: "rnd",
		Question: fmt.Sprintf("Sari, untuk target %s, berapa batch per resep yang harus kami produksi?", q.String()),
		Answer:   ans.String()}}}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Rencana Operasional — %s\n\n**Target produksi:** %s (≈ %s batch total, info batch dari R&D).\n\n", sc.title(), q.String(), num(totalBatch)))
	sb.WriteString("### Kebutuhan vs Stok\n| Bahan | Kebutuhan | Stok | Min | Perlu beli |\n|---|---|---|---|---|\n")
	for _, x := range buys {
		buy := "—"
		if x.Buy > 0 {
			buy = fmt.Sprintf("**%s %s**", num(x.Buy), x.Ing.Unit)
		}
		sb.WriteString(fmt.Sprintf("| %s | %s %s | %s | %s | %s |\n", x.Ing.Name, num(math.Ceil(x.Need)), x.Ing.Unit, num(x.Ing.Stock), num(x.Ing.MinStock), buy))
	}
	bySup := map[string][]buyItem{}
	var sups []string
	for _, x := range buys {
		if x.Buy > 0 {
			if _, ok := bySup[x.Ing.Supplier]; !ok {
				sups = append(sups, x.Ing.Supplier)
			}
			bySup[x.Ing.Supplier] = append(bySup[x.Ing.Supplier], x)
		}
	}
	sb.WriteString("\n### Daftar Belanja ke Supplier\n")
	if len(sups) == 0 {
		sb.WriteString("Stok cukup, tidak perlu belanja tambahan. 👍\n")
	}
	for _, s := range sups {
		sub := 0.0
		var items []string
		for _, x := range bySup[s] {
			items = append(items, fmt.Sprintf("%s %s %s (%s)", x.Ing.Name, num(x.Buy), x.Ing.Unit, rupiah(x.Cost)))
			sub += x.Cost
		}
		sb.WriteString(fmt.Sprintf("- **%s** — %s → subtotal **%s**\n", s, strings.Join(items, "; "), rupiah(sub)))
	}
	orderBy := tl.ProdStart.AddDate(0, 0, -3)
	orderTxt := fmtDate(orderBy)
	if !orderBy.After(sc.Today) {
		orderTxt = "hari ini (" + fmtDate(sc.Today) + ")"
	}
	sb.WriteString(fmt.Sprintf("\n**Total estimasi belanja: %s**. Order paling lambat %s agar bahan datang sebelum produksi.\n\n", rupiah(totalBuy(buys)), orderTxt))
	if sc.Occasion == "" {
		// promo reguler: produksi harian selama periode promo, bukan sekaligus
		campaign := int(tl.End.Sub(tl.PreOrderOpen).Hours()/24) + 1
		perDay := math.Ceil(totalBatch / float64(campaign))
		sb.WriteString(fmt.Sprintf("### Jadwal Produksi Harian (%s – %s)\n", fmtDate(tl.PreOrderOpen), fmtDate(tl.End)))
		sb.WriteString(fmt.Sprintf("- Tambahan ±%s batch/hari di atas produksi rutin, dipanggang bertahap 05.00–09.00 agar etalase selalu fresh.\n", num(perDay)))
		sb.WriteString("- Laminating adonan sore hari sebelumnya, simpan di chiller semalam.\n")
		sb.WriteString("- Cek sisa etalase jam 14.00 — bila >20%, kurangi batch keesokan harinya.\n")
		res.Text = sb.String()
		return res
	}
	perDay := 12.0
	days := int(math.Max(1, math.Ceil(totalBatch/perDay)))
	window := int(tl.LastDelivery.Sub(tl.ProdStart).Hours()/24) + 1
	sb.WriteString(fmt.Sprintf("### Jadwal Produksi (kapasitas ±%s batch/hari, %d hari kerja)\n", num(perDay), days))
	if days > window {
		sb.WriteString(fmt.Sprintf("⚠️ Butuh %d hari tapi jendela produksi hanya %d hari — perlu lembur/shift tambahan atau batasi kuota pre-order.\n", days, window))
	}
	for d := 0; d < days && d < 7; d++ {
		left := totalBatch - float64(d)*perDay
		sb.WriteString(fmt.Sprintf("- %s: %s batch (05.00 adonan, 08.00–15.00 oven, 16.00 packing & QC)\n", fmtDate(tl.ProdStart.AddDate(0, 0, d)), num(math.Min(perDay, left))))
	}
	if days > 7 {
		sb.WriteString(fmt.Sprintf("- …dilanjutkan hingga %s (hari ke-%d)\n", fmtDate(tl.ProdStart.AddDate(0, 0, days-1)), days))
	}
	sb.WriteString(fmt.Sprintf("- Pengiriman terakhir: %s. Simpan kue kering di wadah kedap udara, suhu ruang.\n", fmtDate(tl.LastDelivery)))
	res.Text = sb.String()
	return res
}

func mockFinance(sc *scenario, b *Bakery) mockResult {
	fs := sc.finances(b)
	var ans []string
	for _, f := range fs {
		ans = append(ans, fmt.Sprintf("%s: biaya bahan + kemasan %s per %s", f.Product.Name, rupiah(f.Material), f.Product.Unit))
	}
	res := mockResult{Consults: []mockConsult{{To: "rnd",
		Question: fmt.Sprintf("Sari, berapa biaya bahan + kemasan per unit untuk %s?", sc.focusNames()),
		Answer:   strings.Join(ans, "; ") + ". Angka dari harga bahan terbaru."}}}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Analisis Harga & Margin — %s\n\n", sc.title()))
	sb.WriteString(fmt.Sprintf("Rumus: **HPP = biaya bahan & kemasan (dari R&D) + overhead %d%%** (tenaga kerja, gas, listrik).\n\n", int(overheadPct*100)))
	sb.WriteString("| Produk | Bahan | HPP | Harga kini | Margin | Harga saran | Early bird | Margin EB |\n|---|---|---|---|---|---|---|---|\n")
	totRev, totGP, totQty := 0.0, 0.0, 0.0
	for _, f := range fs {
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s | **%s** | %s | %s |\n", f.Product.Name, rupiah(f.Material), rupiah(f.HPP), rupiah(f.Price), pct(f.Margin), rupiah(f.RecPrice), rupiah(f.EBPrice), pct(f.EBMargin)))
		totRev += f.Revenue
		totGP += f.GrossProfit
		totQty += f.Target
	}
	sb.WriteString("\n### Proyeksi Promo\n")
	sb.WriteString(fmt.Sprintf("- Target terjual: %s unit (asumsi 40%% pesanan di periode early bird).\n", num(totQty)))
	sb.WriteString(fmt.Sprintf("- Proyeksi omzet: **%s** · laba kotor: **%s** (margin %s).\n", rupiah(totRev), rupiah(totGP), pct(totGP/math.Max(totRev, 1))))
	sb.WriteString("- Diskon maksimal yang aman: **10%** (early bird). Di atas itu margin turun di bawah target 50%.\n")

	sb.WriteString("\n### Rekap Omzet 30 Hari\n")
	total := float64(b.TotalRevenue())
	days := float64(len(b.DailyRevenue()))
	sb.WriteString(fmt.Sprintf("- Total omzet: **%s** (rata-rata %s/hari).\n", rupiah(total), rupiah(total/math.Max(days, 1))))
	top := b.SalesByProduct()
	for i := 0; i < 3 && i < len(top); i++ {
		sb.WriteString(fmt.Sprintf("- Top %d: %s — %s (%s dari omzet).\n", i+1, top[i].Product.Name, rupiah(float64(top[i].Revenue)), pct(float64(top[i].Revenue)/total)))
	}
	res.Text = sb.String()
	return res
}

func mockMarketing(sc *scenario, b *Bakery) mockResult {
	fs := sc.finances(b)
	f := fs[0]
	tl := sc.timeline()
	res := mockResult{Consults: []mockConsult{{To: "finance",
		Question: fmt.Sprintf("Bima, harga jual dan diskon early bird %s yang aman untuk margin berapa?", f.Product.Name),
		Answer:   fmt.Sprintf("Harga normal %s, early bird maksimal 10%% jadi %s (margin tetap %s). Jangan diskon lebih dari itu ya.", rupiah(f.RecPrice), rupiah(f.EBPrice), pct(f.EBMargin))}}}

	occ := sc.Occasion
	tagOcc := map[string]string{"Lebaran": "#HampersLebaran #KueLebaran #THR", "Natal": "#HampersNatal #ChristmasCookies", "Imlek": "#HampersImlek #GongXiFaCai", "Valentine": "#ValentineGift #KadoValentine", "": "#RotiEnak #PastryLokal"}[occ]
	moment := map[string]string{"Lebaran": "Lebaran", "Natal": "Natal", "Imlek": "Imlek", "Valentine": "Valentine", "": "minggu ini"}[occ]

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Strategi Promo — %s\n", sc.title()))
	sb.WriteString(fmt.Sprintf("- **Early bird %s–%s:** %s (hemat 10%%, sesuai batas dari Finance), kuota terbatas agar dapur aman.\n", fmtDate(tl.PreOrderOpen), fmtDate(tl.EarlyBirdEnd), rupiah(f.EBPrice)))
	sb.WriteString(fmt.Sprintf("- **Harga normal:** %s. Gratis kartu ucapan custom + free ongkir radius 5 km untuk pembelian ≥3.\n", rupiah(f.RecPrice)))
	sb.WriteString("- **Bundling korporat:** min. 20 pcs, logo perusahaan di kartu ucapan.\n")
	sb.WriteString("- **Reseller/dropship** via WhatsApp Business, katalog di highlight IG.\n\n")

	sb.WriteString("## Caption\n")
	sb.WriteString(fmt.Sprintf("1. **IG Feed:** \"Wangi butter dari oven Gustee sudah siap menemani %s kamu 🧈✨ %s dibuat fresh tiap pagi, tanpa pengawet. Early bird cuma %s sampai %s — slot terbatas! Order via link di bio. %s #GusteeBakery\"\n", moment, f.Product.Name, rupiah(f.EBPrice), fmtDate(tl.EarlyBirdEnd), tagOcc))
	sb.WriteString(fmt.Sprintf("2. **TikTok:** \"POV: kamu nemu %s yang isinya beneran premium 😭 Spill harganya di komen! %s #GusteeBakery #fyp\"\n", strings.ToLower(f.Product.Name), tagOcc))
	sb.WriteString(fmt.Sprintf("3. **IG Story/WA:** \"⏰ H-%d early bird berakhir! Amankan %s kamu sekarang, cukup balas 'MAU' ya 💛\"\n\n", 2, f.Product.Name))

	sb.WriteString("## Ide Reels/TikTok\n")
	sb.WriteString("1. **ASMR packing** — hook: tutup box ditutup *klik*; close-up pita diikat; audio tren lembut.\n")
	sb.WriteString("2. **Behind the scene dapur jam 5 pagi** — Pak Joko menguleni adonan, timelapse oven, ending produk jadi.\n")
	sb.WriteString(fmt.Sprintf("3. **Unboxing reaction** pelanggan + teks harga %s, CTA \"slot tinggal sedikit\".\n\n", rupiah(f.EBPrice)))

	sb.WriteString("## Jadwal Posting\n| Tanggal | Jam | Platform | Konten |\n|---|---|---|---|\n")
	rows := []struct {
		d       time.Time
		jam, pl string
		k       string
	}{
		{tl.PreOrderOpen.AddDate(0, 0, -2), "19.00", "IG Story", "Teaser \"something sweet is coming\""},
		{tl.PreOrderOpen, "11.30", "IG Feed + TikTok", "Launching + caption #1"},
		{tl.PreOrderOpen.AddDate(0, 0, 1), "19.00", "Reels", "ASMR packing"},
		{tl.EarlyBirdEnd.AddDate(0, 0, -2), "12.00", "IG Story + WA", "Countdown early bird (caption #3)"},
		{tl.EarlyBirdEnd.AddDate(0, 0, 2), "19.00", "TikTok", "Behind the scene dapur (caption #2)"},
		{tl.LastDelivery.AddDate(0, 0, -3), "11.30", "IG Feed", "Last call pre-order + testimoni"},
	}
	for _, r := range rows {
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n", fmtDate(r.d), r.jam, r.pl, r.k))
	}
	res.Text = sb.String()
	return res
}

// ---------- Ringkasan CEO ----------

func mockSummary(prompt string, b *Bakery, plan *Plan, reg *Registry) string {
	sc := analyze(prompt, b)
	fs := sc.finances(b)
	_, _, buys := sc.needs(b)
	tl := sc.timeline()
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Ringkasan Eksekutif — %s\n", sc.title()))
	totRev, totGP := 0.0, 0.0
	for _, f := range fs {
		totRev += f.Revenue
		totGP += f.GrossProfit
	}
	sb.WriteString(fmt.Sprintf("Tim siap menjalankan **%s** dengan proyeksi omzet **%s** dan laba kotor **%s**. Modal belanja bahan tambahan sekitar **%s**.\n\n", sc.title(), rupiah(totRev), rupiah(totGP), rupiah(totalBuy(buys))))
	sb.WriteString("## Angka Kunci\n| Produk | Target | HPP | Harga | Early bird | Margin |\n|---|---|---|---|---|---|\n")
	for _, f := range fs {
		sb.WriteString(fmt.Sprintf("| %s | %s %s | %s | %s | %s | %s |\n", f.Product.Name, num(f.Target), f.Product.Unit, rupiah(f.HPP), rupiah(f.RecPrice), rupiah(f.EBPrice), pct(f.RecMargin)))
	}
	sb.WriteString("\n## Timeline\n")
	sb.WriteString(fmt.Sprintf("- %s — teaser & pre-order dibuka\n- s/d %s — early bird\n- %s — mulai produksi\n- %s — pengiriman terakhir\n", fmtDate(tl.PreOrderOpen), fmtDate(tl.EarlyBirdEnd), fmtDate(tl.ProdStart), fmtDate(tl.LastDelivery)))
	if sc.Occasion != "" {
		sb.WriteString(fmt.Sprintf("- %s — hari %s\n", fmtDate(sc.EventDate), sc.Occasion))
	}
	sb.WriteString("\n## Tugas per Tim\n")
	for _, st := range plan.Subtasks {
		if a := reg.ByID[st.Agent]; a != nil {
			sb.WriteString(fmt.Sprintf("- **%s** — %s: %s\n", a.Name, a.Role, st.Judul))
		}
	}
	sb.WriteString("\n## Keputusan yang Perlu Disetujui Owner\n")
	sb.WriteString(fmt.Sprintf("1. Setujui harga %s & early bird %s.\n", rupiah(fs[0].RecPrice), rupiah(fs[0].EBPrice)))
	sb.WriteString(fmt.Sprintf("2. Setujui budget belanja %s (bahan di bawah stok minimum diprioritaskan).\n", rupiah(totalBuy(buys))))
	sb.WriteString("3. Pilih varian baru dari R&D untuk diuji coba minggu ini.\n")
	sb.WriteString("\n_Catatan: dibuat dalam mode demo — angka dihitung dari database Gustee Bakery._\n")
	return sb.String()
}
