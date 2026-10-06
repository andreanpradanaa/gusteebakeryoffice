package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func testBakery(t *testing.T) (*Bakery, *Registry) {
	t.Helper()
	store, err := OpenStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Seed(filepath.Join("data", "seed.json")); err != nil {
		t.Fatal(err)
	}
	b, err := store.LoadBakery()
	if err != nil {
		t.Fatal(err)
	}
	reg, err := LoadRegistry("agents")
	if err != nil {
		t.Fatal(err)
	}
	return b, reg
}

func TestHPP(t *testing.T) {
	b, _ := testBakery(t)
	// Hampers Lebaran = nastar + kastengel + kemasan
	want := b.HPP("nastar") + b.HPP("kastengel") + b.RecipeUnitCost("hampers_pack")
	if got := b.HPP("hampers_lebaran"); got != want || got <= 0 {
		t.Fatalf("HPP hampers = %v, want %v", got, want)
	}
	for _, id := range b.ProductOrder {
		if m := b.Margin(id); m <= 0 || m >= 1 {
			t.Errorf("margin %s tidak wajar: %v", id, m)
		}
	}
}

func TestAnalyze(t *testing.T) {
	b, _ := testBakery(t)
	cases := map[string]string{
		"Siapkan promo hampers Lebaran.":                 "hampers_lebaran",
		"Buat promo Natal untuk kue kering":              "hampers_natal",
		"Siapkan hampers Imlek untuk pelanggan korporat": "hampers_imlek",
		"Naikkan penjualan croissant 2 minggu ke depan":  "croissant",
		"Rencanakan menu spesial Valentine":              "red_velvet",
		"Promo nastar akhir pekan":                       "nastar",
	}
	for prompt, want := range cases {
		sc := analyze(prompt, b)
		if len(sc.Focus) == 0 || sc.Focus[0].ID != want {
			got := ""
			if len(sc.Focus) > 0 {
				got = sc.Focus[0].ID
			}
			t.Errorf("%q → fokus %q, want %q", prompt, got, want)
		}
	}
}

func TestMockOutputs(t *testing.T) {
	b, reg := testBakery(t)
	prompts := []string{
		"Siapkan promo hampers Lebaran.", "Buat promo Natal untuk kue kering", "Rencanakan menu spesial Valentine",
		"Naikkan penjualan croissant 2 minggu ke depan", "Tolong evaluasi bisnis bulan ini",
	}
	for _, p := range prompts {
		plan := mockPlan(p, b, reg)
		if len(plan.Subtasks) != len(reg.Workers()) {
			t.Errorf("%q: %d subtasks", p, len(plan.Subtasks))
		}
		for _, st := range plan.Subtasks {
			m := mockWork(st.Agent, p, b, reg)
			if len(m.Text) < 200 || strings.Contains(m.Text, "%!") {
				t.Errorf("%q/%s: output tidak valid:\n%s", p, st.Agent, m.Text)
			}
			for _, c := range m.Consults {
				if reg.ByID[c.To] == nil || c.Answer == "" {
					t.Errorf("%q/%s: konsultasi tidak valid %+v", p, st.Agent, c)
				}
			}
		}
		sum := mockSummary(p, b, plan, reg)
		if !strings.Contains(sum, "Ringkasan Eksekutif") || strings.Contains(sum, "%!") {
			t.Errorf("%q: ringkasan tidak valid:\n%s", p, sum)
		}
	}
}
