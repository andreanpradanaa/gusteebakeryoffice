package main

import (
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// Event dikirim ke semua pengunjung lewat SSE (/api/events). Kantor ini "shared":
// semua yang membuka website melihat agen yang sama bekerja secara real-time.
type Event struct {
	Type     string      `json:"type"`
	TaskID   string      `json:"taskId,omitempty"`
	Agent    string      `json:"agent,omitempty"`
	Status   string      `json:"status,omitempty"`   // idle | thinking | working | meeting
	Room     string      `json:"room,omitempty"`     // id ruangan tujuan
	Activity string      `json:"activity,omitempty"` // teks singkat apa yang sedang dikerjakan
	MsgID    string      `json:"msgId,omitempty"`
	Text     string      `json:"text,omitempty"`
	Log      *LogEntry   `json:"log,omitempty"`
	Card     *KanbanCard `json:"card,omitempty"`
	Output   *Output     `json:"output,omitempty"`
	Task     *Task       `json:"task,omitempty"`
	Snapshot *Snapshot   `json:"snapshot,omitempty"`
	Time     int64       `json:"time"`
}

type AgentState struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	Room     string `json:"room"`
	Activity string `json:"activity"`
	TaskID   string `json:"taskId,omitempty"`
}

type Snapshot struct {
	Mode       string                 `json:"mode"`
	Model      string                 `json:"model,omitempty"`
	Agents     map[string]*AgentState `json:"agents"`
	Cards      []*KanbanCard          `json:"cards"`
	Logs       []*LogEntry            `json:"logs"`
	ActiveTask string                 `json:"activeTask,omitempty"`
}

type Hub struct {
	mu         sync.Mutex
	subs       map[chan []byte]struct{}
	agents     map[string]*AgentState
	cards      []*KanbanCard
	logs       []*LogEntry
	activeTask string
	store      *Store
	mode       string
	model      string
}

var idCounter atomic.Int64

func newID(prefix string) string {
	return fmt.Sprintf("%s_%d_%d", prefix, time.Now().UnixMilli(), idCounter.Add(1))
}

func NewHub(store *Store, reg *Registry, mode, model string) *Hub {
	h := &Hub{
		subs: map[chan []byte]struct{}{}, agents: map[string]*AgentState{},
		store: store, mode: mode, model: model,
		logs: store.RecentLogs(150), cards: store.RecentCards(60),
	}
	for _, a := range reg.List {
		h.agents[a.ID] = &AgentState{ID: a.ID, Status: "idle", Room: a.Room}
	}
	return h
}

func (h *Hub) Subscribe() (chan []byte, func()) {
	ch := make(chan []byte, 512)
	h.mu.Lock()
	h.subs[ch] = struct{}{}
	h.mu.Unlock()
	return ch, func() {
		h.mu.Lock()
		delete(h.subs, ch)
		h.mu.Unlock()
	}
}

func (h *Hub) Snapshot() *Snapshot {
	h.mu.Lock()
	defer h.mu.Unlock()
	agents := map[string]*AgentState{}
	for k, v := range h.agents {
		c := *v
		agents[k] = &c
	}
	return &Snapshot{
		Mode: h.mode, Model: h.model, Agents: agents,
		Cards: append([]*KanbanCard{}, h.cards...), Logs: append([]*LogEntry{}, h.logs...),
		ActiveTask: h.activeTask,
	}
}

func (h *Hub) publish(e Event) {
	e.Time = time.Now().UnixMilli()
	data, err := json.Marshal(e)
	if err != nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs {
		select {
		case ch <- data:
		default: // klien lambat: lewati event daripada memblokir orkestrasi
		}
	}
}

// ---------- Helper yang dipakai orkestrator ----------

func (h *Hub) SetAgent(id, status, room, activity, taskID string) {
	h.mu.Lock()
	a := h.agents[id]
	if a != nil {
		if status != "" {
			a.Status = status
		}
		if room != "" {
			a.Room = room
		}
		a.Activity = activity
		a.TaskID = taskID
	}
	h.mu.Unlock()
	h.publish(Event{Type: "agent", Agent: id, Status: status, Room: room, Activity: activity, TaskID: taskID})
}

func (h *Hub) BubbleStart(agent, msgID string) {
	h.publish(Event{Type: "bubble_start", Agent: agent, MsgID: msgID})
}

func (h *Hub) BubbleDelta(agent, msgID, text string) {
	h.publish(Event{Type: "bubble_delta", Agent: agent, MsgID: msgID, Text: text})
}

func (h *Hub) BubbleEnd(agent, msgID string) {
	h.publish(Event{Type: "bubble_end", Agent: agent, MsgID: msgID})
}

func (h *Hub) Log(taskID, from, to, text, kind string) {
	l := &LogEntry{ID: newID("log"), TaskID: taskID, From: from, To: to, Text: text, Kind: kind, Time: time.Now().UnixMilli()}
	h.store.SaveLog(l)
	h.mu.Lock()
	h.logs = append(h.logs, l)
	if len(h.logs) > 300 {
		h.logs = h.logs[len(h.logs)-300:]
	}
	h.mu.Unlock()
	h.publish(Event{Type: "log", TaskID: taskID, Log: l})
}

func (h *Hub) Card(c *KanbanCard) {
	c.UpdatedAt = time.Now().UnixMilli()
	h.store.SaveCard(c)
	h.mu.Lock()
	found := false
	for i, x := range h.cards {
		if x.ID == c.ID {
			cp := *c
			h.cards[i] = &cp
			found = true
		}
	}
	if !found {
		cp := *c
		h.cards = append(h.cards, &cp)
		if len(h.cards) > 80 {
			h.cards = h.cards[len(h.cards)-80:]
		}
	}
	h.mu.Unlock()
	cp := *c
	h.publish(Event{Type: "card", TaskID: c.TaskID, Card: &cp})
}

func (h *Hub) Output(o *Output) {
	h.store.SaveOutput(o)
	h.publish(Event{Type: "output", TaskID: o.TaskID, Agent: o.Agent, Output: o})
}

func (h *Hub) TaskUpdate(t *Task) {
	h.mu.Lock()
	if t.Status == "berjalan" {
		h.activeTask = t.ID
	} else if h.activeTask == t.ID {
		h.activeTask = ""
	}
	h.mu.Unlock()
	cp := *t
	cp.Outputs = nil
	h.publish(Event{Type: "task", TaskID: t.ID, Task: &cp})
}
