package main

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

var wib = time.FixedZone("WIB", 7*3600)

// Bakery adalah snapshot data master Gustee Bakery yang dimuat dari SQLite.
type Bakery struct {
	Ingredients     map[string]*Ingredient
	IngredientOrder []string
	Recipes         map[string]*Recipe
	RecipeOrder     []string
	Products        map[string]*Product
	ProductOrder    []string
	Sales           []SaleRow
}

// RecipeBatchCost = total biaya bahan untuk 1 batch resep.
func (b *Bakery) RecipeBatchCost(id string) float64 {
	r := b.Recipes[id]
	if r == nil {
		return 0
	}
	total := 0.0
	for _, it := range r.Items {
		if ing := b.Ingredients[it.IngredientID]; ing != nil {
			total += ing.Price * it.Qty
		}
	}
	return total
}

// RecipeUnitCost = biaya bahan per unit hasil (batch / yield).
func (b *Bakery) RecipeUnitCost(id string) float64 {
	r := b.Recipes[id]
	if r == nil || r.Yield == 0 {
		return 0
	}
	return b.RecipeBatchCost(id) / r.Yield
}

// HPP produk = biaya resep per unit + HPP isi bundle (untuk hampers).
func (b *Bakery) HPP(productID string) float64 {
	p := b.Products[productID]
	if p == nil {
		return 0
	}
	cost := b.RecipeUnitCost(p.RecipeID)
	for _, bi := range p.Bundle {
		cost += b.HPP(bi.ProductID) * bi.Qty
	}
	return cost
}

func (b *Bakery) Margin(productID string) float64 {
	p := b.Products[productID]
	if p == nil || p.Price == 0 {
		return 0
	}
	return (float64(p.Price) - b.HPP(productID)) / float64(p.Price)
}

type ProductSales struct {
	Product *Product
	Qty     int64
	Revenue int64
}

func (b *Bakery) SalesByProduct() []ProductSales {
	agg := map[string]*ProductSales{}
	for _, s := range b.Sales {
		ps := agg[s.ProductID]
		if ps == nil {
			ps = &ProductSales{Product: b.Products[s.ProductID]}
			agg[s.ProductID] = ps
		}
		ps.Qty += s.Qty
		ps.Revenue += s.Revenue
	}
	var out []ProductSales
	for _, v := range agg {
		if v.Product != nil {
			out = append(out, *v)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Revenue > out[j].Revenue })
	return out
}

func (b *Bakery) TotalRevenue() int64 {
	var t int64
	for _, s := range b.Sales {
		t += s.Revenue
	}
	return t
}

type DaySales struct {
	Date    string `json:"date"`
	Revenue int64  `json:"revenue"`
	Qty     int64  `json:"qty"`
}

func (b *Bakery) DailyRevenue() []DaySales {
	m := map[string]*DaySales{}
	var keys []string
	for _, s := range b.Sales {
		d := m[s.Date]
		if d == nil {
			d = &DaySales{Date: s.Date}
			m[s.Date] = d
			keys = append(keys, s.Date)
		}
		d.Revenue += s.Revenue
		d.Qty += s.Qty
	}
	sort.Strings(keys)
	out := make([]DaySales, 0, len(keys))
	for _, k := range keys {
		out = append(out, *m[k])
	}
	return out
}

// IngredientNeeds menghitung kebutuhan bahan untuk memproduksi qty unit produk (termasuk isi bundle).
func (b *Bakery) IngredientNeeds(productID string, qty float64, acc map[string]float64, batches map[string]float64) {
	p := b.Products[productID]
	if p == nil {
		return
	}
	if r := b.Recipes[p.RecipeID]; r != nil && r.Yield > 0 {
		nb := qty / r.Yield
		batches[r.ID] += nb
		for _, it := range r.Items {
			acc[it.IngredientID] += it.Qty * nb
		}
	}
	for _, bi := range p.Bundle {
		b.IngredientNeeds(bi.ProductID, qty*bi.Qty, acc, batches)
	}
}

// ---------- Format ----------

func rupiah(v float64) string {
	n := int64(math.Round(v))
	neg := n < 0
	if neg {
		n = -n
	}
	s := fmt.Sprintf("%d", n)
	var parts []string
	for len(s) > 3 {
		parts = append([]string{s[len(s)-3:]}, parts...)
		s = s[:len(s)-3]
	}
	parts = append([]string{s}, parts...)
	out := "Rp" + strings.Join(parts, ".")
	if neg {
		return "-" + out
	}
	return out
}

func num(v float64) string {
	if v == math.Trunc(v) {
		return strings.TrimPrefix(rupiah(v), "Rp")
	}
	return strings.Replace(fmt.Sprintf("%.1f", v), ".", ",", 1)
}

func pct(v float64) string { return strings.Replace(fmt.Sprintf("%.1f%%", v*100), ".", ",", 1) }

func roundUp(v float64, step float64) float64 { return math.Ceil(v/step) * step }

// ---------- Konteks data per agen ----------

func (b *Bakery) ContextFor(scopes []string) string {
	var sb strings.Builder
	for _, sc := range scopes {
		switch sc {
		case "katalog":
			sb.WriteString(b.catalogText())
		case "resep":
			sb.WriteString(b.recipeText())
		case "stok":
			sb.WriteString(b.stockText())
		case "penjualan":
			sb.WriteString(b.salesText())
		}
		sb.WriteString("\n")
	}
	return sb.String()
}

func (b *Bakery) catalogText() string {
	var sb strings.Builder
	sb.WriteString("## Katalog produk & harga jual\n")
	for _, id := range b.ProductOrder {
		p := b.Products[id]
		line := fmt.Sprintf("- [%s] %s (%s) — %s / %s", p.ID, p.Name, p.Category, rupiah(float64(p.Price)), p.Unit)
		if len(p.Bundle) > 0 {
			var items []string
			for _, bi := range p.Bundle {
				if bp := b.Products[bi.ProductID]; bp != nil {
					items = append(items, fmt.Sprintf("%s x%s", bp.Name, num(bi.Qty)))
				}
			}
			line += " · isi: " + strings.Join(items, ", ") + " + box & kartu ucapan"
		}
		sb.WriteString(line + "\n")
	}
	return sb.String()
}

func (b *Bakery) recipeText() string {
	var sb strings.Builder
	sb.WriteString("## Resep & costing bahan (harga bahan terkini)\n")
	for _, id := range b.RecipeOrder {
		r := b.Recipes[id]
		sb.WriteString(fmt.Sprintf("### %s [%s] — 1 batch = %s %s\n", r.Name, r.ID, num(r.Yield), r.YieldUnit))
		for _, it := range r.Items {
			ing := b.Ingredients[it.IngredientID]
			if ing == nil {
				continue
			}
			sb.WriteString(fmt.Sprintf("- %s: %s %s × %s = %s\n", ing.Name, num(it.Qty), ing.Unit, rupiah(ing.Price), rupiah(ing.Price*it.Qty)))
		}
		sb.WriteString(fmt.Sprintf("Total biaya batch: %s · biaya per %s: %s\n", rupiah(b.RecipeBatchCost(id)), r.YieldUnit, rupiah(b.RecipeUnitCost(id))))
	}
	return sb.String()
}

func (b *Bakery) stockText() string {
	var sb strings.Builder
	sb.WriteString("## Stok bahan & kemasan di gudang\n")
	for _, id := range b.IngredientOrder {
		i := b.Ingredients[id]
		flag := ""
		if i.Stock < i.MinStock {
			flag = " ⚠️ DI BAWAH MINIMUM"
		}
		sb.WriteString(fmt.Sprintf("- [%s] %s: stok %s %s (min %s) · harga %s/%s · supplier: %s%s\n",
			i.ID, i.Name, num(i.Stock), i.Unit, num(i.MinStock), rupiah(i.Price), i.Unit, i.Supplier, flag))
	}
	return sb.String()
}

func (b *Bakery) salesText() string {
	var sb strings.Builder
	sb.WriteString("## Penjualan 30 hari terakhir\n")
	sb.WriteString(fmt.Sprintf("Total omzet: %s\n", rupiah(float64(b.TotalRevenue()))))
	for _, ps := range b.SalesByProduct() {
		sb.WriteString(fmt.Sprintf("- %s: %d %s terjual · omzet %s\n", ps.Product.Name, ps.Qty, ps.Product.Unit, rupiah(float64(ps.Revenue))))
	}
	daily := b.DailyRevenue()
	sb.WriteString("Omzet mingguan (7 hari per baris, dari terlama):\n")
	for i := 0; i < len(daily); i += 7 {
		end := i + 7
		if end > len(daily) {
			end = len(daily)
		}
		var t int64
		for _, d := range daily[i:end] {
			t += d.Revenue
		}
		sb.WriteString(fmt.Sprintf("- %s s/d %s: %s\n", daily[i].Date, daily[end-1].Date, rupiah(float64(t))))
	}
	return sb.String()
}
