package main

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/anthropics/anthropic-sdk-go"
)

type Plan struct {
	Pembuka  string    `json:"pembuka"`
	Subtasks []Subtask `json:"subtasks"`
}

type Subtask struct {
	Agent     string `json:"agent"`
	Judul     string `json:"judul"`
	Instruksi string `json:"instruksi"`
}

// Orchestrator menjalankan alur: Owner → CEO memecah tugas → rapat → agen bekerja paralel
// (boleh saling bertanya) → CEO meninjau → CEO merangkum rencana akhir.
type Orchestrator struct {
	hub   *Hub
	store *Store
	reg   *Registry
	llm   *LLM // nil = mode demo
	queue chan *Task

	// Timing animasi (agar karakter sempat berjalan di peta).
	walk time.Duration

	// Satu agen hanya menjawab satu pertanyaan pada satu waktu (antre), agar bubble tidak saling timpa.
	answerMu sync.Map // agentID → *sync.Mutex
}

func (o *Orchestrator) answerLock(agent string) *sync.Mutex {
	m, _ := o.answerMu.LoadOrStore(agent, &sync.Mutex{})
	return m.(*sync.Mutex)
}

func NewOrchestrator(hub *Hub, store *Store, reg *Registry, llm *LLM) *Orchestrator {
	return &Orchestrator{hub: hub, store: store, reg: reg, llm: llm, queue: make(chan *Task, 20), walk: 4 * time.Second}
}

func (o *Orchestrator) Mode() string {
	if o.llm != nil {
		return "llm"
	}
	return "demo"
}

func (o *Orchestrator) Submit(prompt string) (*Task, error) {
	t := &Task{ID: newID("task"), Prompt: prompt, Status: "antre", Mode: o.Mode(), CreatedAt: time.Now().UnixMilli(), Outputs: []*Output{}}
	if err := o.store.CreateTask(t); err != nil {
		return nil, err
	}
	select {
	case o.queue <- t:
	default:
		o.store.FinishTask(t.ID, "gagal", "Antrean penuh")
		return nil, fmt.Errorf("antrean tugas penuh, coba lagi nanti")
	}
	o.hub.TaskUpdate(t)
	o.hub.Log(t.ID, "owner", "ceo", prompt, "perintah")
	if len(o.queue) > 1 || o.hub.Snapshot().ActiveTask != "" {
		o.hub.Log(t.ID, "sistem", "", "Tugas masuk antrean — tim sedang mengerjakan tugas lain.", "sistem")
	}
	return t, nil
}

func (o *Orchestrator) Loop() {
	for t := range o.queue {
		o.run(t)
	}
}

func todayWIB() string {
	return time.Now().In(wib).Format("Monday, 2 January 2006 (15:04 WIB)")
}

func shorten(s string, n int) string {
	s = strings.TrimSpace(strings.ReplaceAll(s, "\n", " "))
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:n-1]) + "…"
}

func (o *Orchestrator) run(t *Task) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()
	defer func() {
		if r := recover(); r != nil {
			o.hub.Log(t.ID, "sistem", "", fmt.Sprintf("Terjadi kesalahan internal: %v", r), "sistem")
			o.store.FinishTask(t.ID, "gagal", "")
			t.Status = "gagal"
			o.hub.TaskUpdate(t)
			o.resetAgents()
		}
	}()

	b, err := o.store.LoadBakery()
	if err != nil {
		o.hub.Log(t.ID, "sistem", "", "Gagal memuat data bakery: "+err.Error(), "sistem")
		o.store.FinishTask(t.ID, "gagal", "")
		return
	}
	t.Status = "berjalan"
	o.store.UpdateTaskStatus(t.ID, t.Status)
	o.hub.TaskUpdate(t)

	ceo := o.reg.ByID["ceo"]
	ceoCard := &KanbanCard{ID: newID("card"), TaskID: t.ID, Title: "Koordinasi: " + shorten(t.Prompt, 60), Agent: "ceo", Column: "progress"}
	o.hub.Card(ceoCard)

	// 1) CEO membaca & memecah perintah
	o.hub.SetAgent("ceo", "thinking", ceo.Room, "Memecah perintah owner", t.ID)
	o.say("ceo", fmt.Sprintf("Perintah baru dari owner: “%s”. Saya pecah dulu jadi sub-tugas…", shorten(t.Prompt, 80)))
	plan := o.plan(ctx, t, b)

	// 2) Rapat di ruang meeting
	o.hub.Log(t.ID, "ceo", "", "Tim, semua kumpul di ruang meeting sekarang ya!", "pesan")
	for _, a := range o.reg.List {
		o.hub.SetAgent(a.ID, "meeting", "meeting", "Rapat koordinasi", t.ID)
	}
	o.sleep(ctx, o.walk+time.Second)
	o.say("ceo", plan.Pembuka)
	cards := map[string]*KanbanCard{}
	for _, st := range plan.Subtasks {
		c := &KanbanCard{ID: newID("card"), TaskID: t.ID, Title: st.Judul, Agent: st.Agent, Column: "todo"}
		cards[st.Agent] = c
		o.hub.Card(c)
		o.hub.Log(t.ID, "ceo", st.Agent, st.Judul+" — "+st.Instruksi, "perintah")
		o.sleep(ctx, 700*time.Millisecond)
	}
	o.sleep(ctx, 1200*time.Millisecond)
	// Agen yang tidak mendapat tugas kembali ke ruangannya.
	assigned := map[string]bool{}
	for _, st := range plan.Subtasks {
		assigned[st.Agent] = true
	}
	for _, a := range o.reg.List {
		if !assigned[a.ID] && a.ID != "ceo" {
			o.hub.SetAgent(a.ID, "idle", a.Room, "", "")
		}
	}
	o.hub.SetAgent("ceo", "working", ceo.Room, "Memantau progres tim", t.ID)

	// 3) Agen bekerja paralel
	var mu sync.Mutex
	results := map[string]string{}
	var wg sync.WaitGroup
	for i, st := range plan.Subtasks {
		wg.Add(1)
		go func(i int, st Subtask) {
			defer wg.Done()
			o.sleep(ctx, time.Duration(i)*900*time.Millisecond)
			out := o.work(ctx, t, st, cards[st.Agent], b)
			mu.Lock()
			results[st.Agent] = out
			mu.Unlock()
		}(i, st)
	}
	wg.Wait()

	// 4) CEO meninjau
	o.hub.SetAgent("ceo", "working", ceo.Room, "Meninjau hasil tim", t.ID)
	for _, st := range plan.Subtasks {
		c := cards[st.Agent]
		c.Column = "done"
		o.hub.Card(c)
		o.hub.Log(t.ID, "ceo", st.Agent, "✓ Hasil diterima: "+st.Judul, "pesan")
		o.sleep(ctx, 600*time.Millisecond)
	}

	// 5) CEO merangkum
	o.hub.SetAgent("ceo", "working", ceo.Room, "Menyusun rencana akhir", t.ID)
	final := o.summarize(ctx, t, plan, results, b)
	out := &Output{ID: newID("out"), TaskID: t.ID, Agent: "ceo", Title: "Rencana Akhir — " + shorten(t.Prompt, 50), Content: final, CreatedAt: time.Now().UnixMilli()}
	o.hub.Output(out)
	ceoCard.Column = "done"
	o.hub.Card(ceoCard)
	o.hub.Log(t.ID, "ceo", "owner", "Rencana akhir sudah siap di panel Hasil Kerja. Silakan direview, Owner!", "hasil")
	t.Status = "selesai"
	o.store.FinishTask(t.ID, t.Status, final)
	o.hub.TaskUpdate(t)
	o.resetAgents()
}

func (o *Orchestrator) resetAgents() {
	for _, a := range o.reg.List {
		o.hub.SetAgent(a.ID, "idle", a.Room, "", "")
	}
}

func (o *Orchestrator) sleep(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}

// say menampilkan kalimat pendek di bubble agen (diketik bertahap).
func (o *Orchestrator) say(agent, text string) {
	id := newID("msg")
	o.hub.BubbleStart(agent, id)
	o.streamText(context.Background(), agent, id, text, 35*time.Millisecond)
	o.hub.BubbleEnd(agent, id)
	if agent != "" {
		o.hub.Log("", agent, "", text, "pesan")
	}
}

// streamText mensimulasikan streaming untuk mode demo: kirim per 1–3 kata.
func (o *Orchestrator) streamText(ctx context.Context, agent, msgID, text string, perChunk time.Duration) {
	words := strings.SplitAfter(text, " ")
	for i := 0; i < len(words); {
		n := 1 + rand.Intn(3)
		if i+n > len(words) {
			n = len(words) - i
		}
		o.hub.BubbleDelta(agent, msgID, strings.Join(words[i:i+n], ""))
		i += n
		select {
		case <-ctx.Done():
			return
		case <-time.After(perChunk + time.Duration(rand.Intn(25))*time.Millisecond):
		}
	}
}

func (o *Orchestrator) plan(ctx context.Context, t *Task, b *Bakery) *Plan {
	var workers []string
	for _, w := range o.reg.Workers() {
		workers = append(workers, w.ID)
	}
	if o.llm != nil {
		ceo := o.reg.ByID["ceo"]
		var list []string
		for _, w := range o.reg.Workers() {
			list = append(list, fmt.Sprintf("- %s: %s (%s)", w.ID, w.Name, w.Role))
		}
		user := fmt.Sprintf("Tanggal hari ini: %s\n\nPerintah owner:\n%s\n\nAgen yang tersedia:\n%s\n\n"+
			"Buat rencana kerja. `pembuka` = 1–2 kalimat briefingmu di rapat tim (gaya lisan, hangat). "+
			"`subtasks` = satu sub-tugas per agen yang relevan, dengan `judul` singkat (maks 6 kata) dan `instruksi` spesifik (maks 45 kata) "+
			"yang menyebut dengan siapa agen itu perlu berkoordinasi.",
			todayWIB(), t.Prompt, strings.Join(list, "\n"))
		p, err := o.llm.PlanJSON(ctx, o.reg.SystemPrompt(ceo, b), user, workers)
		if err == nil {
			valid := p.Subtasks[:0]
			seen := map[string]bool{}
			for _, st := range p.Subtasks {
				if a := o.reg.ByID[st.Agent]; a != nil && a.Worker && !seen[st.Agent] {
					seen[st.Agent] = true
					valid = append(valid, st)
				}
			}
			p.Subtasks = valid
			if len(p.Subtasks) > 0 {
				return p
			}
			err = fmt.Errorf("rencana tidak berisi sub-tugas")
		}
		o.hub.Log(t.ID, "sistem", "", "⚠️ CEO gagal memanggil LLM ("+err.Error()+"). Memakai rencana demo.", "sistem")
	}
	o.sleep(ctx, 1500*time.Millisecond)
	return mockPlan(t.Prompt, b, o.reg)
}

func (o *Orchestrator) userMessage(t *Task, st Subtask) string {
	return fmt.Sprintf("Tanggal hari ini: %s\n\nPerintah owner ke Owner CEO:\n%s\n\nTugas dari Owner CEO untukmu — **%s**:\n%s\n\n"+
		"Kerjakan sekarang dan tulis hasil kerjamu (Markdown). Jika butuh data dari agen lain, gunakan tool `tanya_agen`.",
		todayWIB(), t.Prompt, st.Judul, st.Instruksi)
}

func (o *Orchestrator) work(ctx context.Context, t *Task, st Subtask, card *KanbanCard, b *Bakery) string {
	a := o.reg.ByID[st.Agent]
	card.Column = "progress"
	o.hub.Card(card)
	o.hub.SetAgent(a.ID, "thinking", a.Room, st.Judul, t.ID)
	o.sleep(ctx, o.walk)
	o.hub.SetAgent(a.ID, "working", a.Room, st.Judul, t.ID)

	var text string
	consult := func(ctx context.Context, to, q string) (string, error) {
		return o.consult(ctx, t, a.ID, to, q, st.Judul, b)
	}
	if o.llm != nil {
		msgID := newID("msg")
		o.hub.BubbleStart(a.ID, msgID)
		tools := []anthropic.ToolUnionParam{consultTool(a.ID, o.reg)}
		out, err := o.llm.Run(ctx, o.reg.SystemPrompt(a, b), o.userMessage(t, st), tools,
			func(d string) { o.hub.BubbleDelta(a.ID, msgID, d) }, consult)
		o.hub.BubbleEnd(a.ID, msgID)
		if err != nil {
			o.hub.Log(t.ID, "sistem", "", fmt.Sprintf("⚠️ %s gagal memanggil LLM (%s). Memakai jawaban demo.", a.Role, err.Error()), "sistem")
		} else {
			text = out
		}
	}
	if text == "" {
		m := mockWork(a.ID, t.Prompt, b, o.reg)
		for _, c := range m.Consults {
			_, _ = o.consultMock(ctx, t, a.ID, c, st.Judul)
		}
		o.hub.SetAgent(a.ID, "working", a.Room, st.Judul, t.ID)
		msgID := newID("msg")
		o.hub.BubbleStart(a.ID, msgID)
		o.streamText(ctx, a.ID, msgID, m.Text, 30*time.Millisecond)
		o.hub.BubbleEnd(a.ID, msgID)
		text = m.Text
	}

	o.hub.Output(&Output{ID: newID("out"), TaskID: t.ID, Agent: a.ID, Title: st.Judul, Content: text, CreatedAt: time.Now().UnixMilli()})
	card.Column = "review"
	o.hub.Card(card)
	o.hub.Log(t.ID, a.ID, "ceo", "Selesai: "+st.Judul+". Hasil sudah saya kirim untuk direview.", "hasil")
	o.hub.SetAgent(a.ID, "idle", a.Room, "Menunggu review CEO", t.ID)
	return text
}

// consult: agen `from` berjalan ke ruangan agen `to`, bertanya, dan `to` menjawab (streaming di bubble).
func (o *Orchestrator) consult(ctx context.Context, t *Task, from, to, question, activity string, b *Bakery) (string, error) {
	asker, target := o.reg.ByID[from], o.reg.ByID[to]
	if target == nil || to == from {
		return "", fmt.Errorf("agen %q tidak dikenal", to)
	}
	prev := o.hub.Snapshot().Agents[to]
	o.hub.Log(t.ID, from, to, question, "tanya")
	o.hub.SetAgent(from, "thinking", target.Room, "Bertanya ke "+target.Role, t.ID)
	o.sleep(ctx, o.walk/2)
	lock := o.answerLock(to)
	lock.Lock()
	defer lock.Unlock()
	prev = o.hub.Snapshot().Agents[to]
	o.hub.SetAgent(to, "thinking", "", "Menjawab "+asker.Role, t.ID)

	msgID := newID("msg")
	o.hub.BubbleStart(to, msgID)
	user := fmt.Sprintf("Tanggal hari ini: %s\n\nRekanmu %s (%s) sedang mengerjakan \"%s\" untuk perintah owner: \"%s\".\n\n"+
		"Pertanyaannya untukmu:\n%s\n\nJawab langsung, singkat (maks 120 kata), pakai angka dari datamu. Jangan pakai judul.",
		todayWIB(), asker.Name, asker.Role, activity, t.Prompt, question)
	answer, err := o.llm.Run(ctx, o.reg.SystemPrompt(target, b), user, nil,
		func(d string) { o.hub.BubbleDelta(to, msgID, d) }, nil)
	o.hub.BubbleEnd(to, msgID)

	if prev != nil {
		o.hub.SetAgent(to, prev.Status, "", prev.Activity, prev.TaskID)
	}
	o.hub.SetAgent(from, "working", asker.Room, activity, t.ID)
	if err != nil {
		return "", err
	}
	o.hub.Log(t.ID, to, from, answer, "jawab")
	o.sleep(ctx, o.walk/2)
	return answer, nil
}

func (o *Orchestrator) consultMock(ctx context.Context, t *Task, from string, c mockConsult, activity string) (string, error) {
	asker, target := o.reg.ByID[from], o.reg.ByID[c.To]
	if target == nil {
		return "", nil
	}
	prev := o.hub.Snapshot().Agents[c.To]
	o.hub.Log(t.ID, from, c.To, c.Question, "tanya")
	o.hub.SetAgent(from, "thinking", target.Room, "Bertanya ke "+target.Role, t.ID)
	askID := newID("msg")
	o.hub.BubbleStart(from, askID)
	o.streamText(ctx, from, askID, c.Question, 40*time.Millisecond)
	o.hub.BubbleEnd(from, askID)
	o.sleep(ctx, o.walk/2)

	lock := o.answerLock(c.To)
	lock.Lock()
	prev = o.hub.Snapshot().Agents[c.To]
	o.hub.SetAgent(c.To, "thinking", "", "Menjawab "+asker.Role, t.ID)
	msgID := newID("msg")
	o.hub.BubbleStart(c.To, msgID)
	o.streamText(ctx, c.To, msgID, c.Answer, 40*time.Millisecond)
	o.hub.BubbleEnd(c.To, msgID)
	o.hub.Log(t.ID, c.To, from, c.Answer, "jawab")
	if prev != nil {
		o.hub.SetAgent(c.To, prev.Status, "", prev.Activity, prev.TaskID)
	}
	lock.Unlock()
	o.hub.SetAgent(from, "working", asker.Room, activity, t.ID)
	o.sleep(ctx, o.walk/2)
	return c.Answer, nil
}

func (o *Orchestrator) summarize(ctx context.Context, t *Task, plan *Plan, results map[string]string, b *Bakery) string {
	if o.llm != nil {
		var sb strings.Builder
		for _, st := range plan.Subtasks {
			a := o.reg.ByID[st.Agent]
			sb.WriteString(fmt.Sprintf("\n\n---\n### Hasil %s (%s) — %s\n%s", a.Name, a.Role, st.Judul, results[st.Agent]))
		}
		user := fmt.Sprintf("Tanggal hari ini: %s\n\nPerintah owner:\n%s\n\nBerikut hasil kerja tim:%s\n\n---\n"+
			"Susun **rencana akhir** untuk owner dalam Markdown: `## Ringkasan Eksekutif`, `## Angka Kunci` (tabel), "+
			"`## Timeline`, `## Tugas per Tim`, `## Keputusan yang Perlu Disetujui Owner`. Tandai jika ada angka yang tidak konsisten antar-tim. Maks 450 kata.",
			todayWIB(), t.Prompt, sb.String())
		msgID := newID("msg")
		o.hub.BubbleStart("ceo", msgID)
		out, err := o.llm.Run(ctx, o.reg.SystemPrompt(o.reg.ByID["ceo"], b), user, nil,
			func(d string) { o.hub.BubbleDelta("ceo", msgID, d) }, nil)
		o.hub.BubbleEnd("ceo", msgID)
		if err == nil && out != "" {
			return out
		}
		o.hub.Log(t.ID, "sistem", "", "⚠️ CEO gagal merangkum via LLM. Memakai ringkasan demo.", "sistem")
	}
	text := mockSummary(t.Prompt, b, plan, o.reg)
	msgID := newID("msg")
	o.hub.BubbleStart("ceo", msgID)
	o.streamText(ctx, "ceo", msgID, text, 25*time.Millisecond)
	o.hub.BubbleEnd("ceo", msgID)
	return text
}
