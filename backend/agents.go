package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// AgentDef dimuat dari agents/agents.json. Tambah agen baru cukup dengan menambah entri di
// file itu + file prompt di agents/prompts/ (lihat README).
type AgentDef struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Role       string   `json:"role"`
	Room       string   `json:"room"`
	PromptFile string   `json:"promptFile"`
	DataScopes []string `json:"dataScopes"`
	Worker     bool     `json:"worker"`

	prompt string
}

type Registry struct {
	List   []*AgentDef
	ByID   map[string]*AgentDef
	common string
}

func LoadRegistry(dir string) (*Registry, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "agents.json"))
	if err != nil {
		return nil, err
	}
	var list []*AgentDef
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("agents.json tidak valid: %w", err)
	}
	common, err := os.ReadFile(filepath.Join(dir, "prompts", "_umum.md"))
	if err != nil {
		return nil, err
	}
	reg := &Registry{List: list, ByID: map[string]*AgentDef{}, common: string(common)}
	for _, a := range list {
		p, err := os.ReadFile(filepath.Join(dir, "prompts", a.PromptFile))
		if err != nil {
			return nil, fmt.Errorf("prompt agen %s: %w", a.ID, err)
		}
		a.prompt = string(p)
		reg.ByID[a.ID] = a
	}
	if reg.ByID["ceo"] == nil {
		return nil, fmt.Errorf("agents.json wajib memiliki agen dengan id \"ceo\"")
	}
	return reg, nil
}

func (r *Registry) Workers() []*AgentDef {
	var out []*AgentDef
	for _, a := range r.List {
		if a.Worker {
			out = append(out, a)
		}
	}
	return out
}

func (r *Registry) Label(id string) string {
	if id == "owner" {
		return "Owner"
	}
	if a := r.ByID[id]; a != nil {
		return a.Role
	}
	return id
}

// SystemPrompt = aturan umum + peran agen + data Gustee Bakery sesuai cakupan agen.
func (r *Registry) SystemPrompt(a *AgentDef, b *Bakery) string {
	var sb strings.Builder
	sb.WriteString(r.common)
	sb.WriteString("\n\n")
	sb.WriteString(a.prompt)
	sb.WriteString("\n\n# Data Gustee Bakery yang kamu pegang\n")
	sb.WriteString(b.ContextFor(a.DataScopes))
	return sb.String()
}
