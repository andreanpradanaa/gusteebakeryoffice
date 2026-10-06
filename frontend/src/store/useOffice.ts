import { create } from 'zustand';
import { AGENTS } from '../config/agents';
import type { AgentState, KanbanCard, LogEntry, ServerEvent, Task } from '../lib/types';
import type { Phase } from '../lib/time';

export interface Bubble {
  msgId: string;
  text: string;
  done: boolean;
  at: number; // waktu update terakhir
}

export type AgentRuntime = AgentState & { bubble?: Bubble };
export type Tab = 'log' | 'kanban' | 'hasil' | 'data';
export type ThemePref = 'auto' | 'light' | 'dark';

interface OfficeState {
  connected: boolean;
  mode: 'demo' | 'llm' | 'unknown';
  model?: string;
  agents: Record<string, AgentRuntime>;
  logs: LogEntry[];
  cards: KanbanCard[];
  tasks: Task[];
  activeTask?: string;

  selectedAgent: string | null;
  tab: Tab;
  sheetOpen: boolean;
  themePref: ThemePref;
  phaseOverride: Phase | 'auto';
  expandedTask: string | null;

  applyEvent: (e: ServerEvent) => void;
  setConnected: (c: boolean) => void;
  setTasks: (t: Task[]) => void;
  selectAgent: (id: string | null) => void;
  setTab: (t: Tab) => void;
  setSheetOpen: (o: boolean) => void;
  setThemePref: (t: ThemePref) => void;
  setPhaseOverride: (p: Phase | 'auto') => void;
  setExpandedTask: (id: string | null) => void;
}

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* mode privat */
  }
}

const initialAgents = (): Record<string, AgentRuntime> =>
  Object.fromEntries(AGENTS.map((a) => [a.id, { id: a.id, status: 'idle', room: a.home, activity: '' }]));

export const useOffice = create<OfficeState>((set) => ({
  connected: false,
  mode: 'unknown',
  agents: initialAgents(),
  logs: [],
  cards: [],
  tasks: [],
  selectedAgent: null,
  tab: 'log',
  sheetOpen: false,
  themePref: readPref<ThemePref>('gustee-theme', 'auto'),
  phaseOverride: 'auto',
  expandedTask: null,

  setConnected: (connected) => set({ connected }),
  setTasks: (tasks) => set({ tasks }),
  selectAgent: (selectedAgent) => set({ selectedAgent }),
  setTab: (tab) => set({ tab, sheetOpen: true }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  setThemePref: (themePref) => {
    writePref('gustee-theme', themePref);
    set({ themePref });
  },
  setPhaseOverride: (phaseOverride) => set({ phaseOverride }),
  setExpandedTask: (expandedTask) => set({ expandedTask }),

  applyEvent: (e) =>
    set((s) => {
      switch (e.type) {
        case 'snapshot': {
          const snap = e.snapshot!;
          const agents = { ...initialAgents() };
          for (const [id, a] of Object.entries(snap.agents)) agents[id] = { ...a, bubble: s.agents[id]?.bubble };
          return {
            mode: snap.mode,
            model: snap.model,
            agents,
            cards: snap.cards ?? [],
            logs: snap.logs ?? [],
            activeTask: snap.activeTask || undefined,
          };
        }
        case 'agent': {
          const prev = s.agents[e.agent!] ?? { id: e.agent!, status: 'idle', room: '', activity: '' };
          return {
            agents: {
              ...s.agents,
              [e.agent!]: {
                ...prev,
                status: e.status || prev.status,
                room: e.room || prev.room,
                activity: e.activity ?? '',
                taskId: e.taskId,
              },
            },
          };
        }
        case 'bubble_start':
        case 'bubble_delta':
        case 'bubble_end': {
          const prev = s.agents[e.agent!];
          if (!prev) return {};
          let b = prev.bubble;
          if (!b || b.msgId !== e.msgId) b = { msgId: e.msgId!, text: '', done: false, at: Date.now() };
          b = {
            ...b,
            text: e.type === 'bubble_delta' ? (b.text + (e.text ?? '')).slice(-1200) : b.text,
            done: e.type === 'bubble_end',
            at: Date.now(),
          };
          return { agents: { ...s.agents, [e.agent!]: { ...prev, bubble: b } } };
        }
        case 'log':
          return { logs: [...s.logs, e.log!].slice(-300) };
        case 'card': {
          const c = e.card!;
          const idx = s.cards.findIndex((x) => x.id === c.id);
          const cards = idx >= 0 ? s.cards.map((x) => (x.id === c.id ? c : x)) : [...s.cards, c].slice(-80);
          return { cards };
        }
        case 'output': {
          const o = e.output!;
          let found = false;
          const tasks = s.tasks.map((t) => {
            if (t.id !== o.taskId) return t;
            found = true;
            return { ...t, outputs: [...t.outputs.filter((x) => x.id !== o.id), o] };
          });
          if (!found)
            tasks.unshift({ id: o.taskId, prompt: '…', status: 'berjalan', mode: 'demo', createdAt: o.createdAt, outputs: [o] });
          return { tasks };
        }
        case 'task': {
          const t = e.task!;
          const existing = s.tasks.find((x) => x.id === t.id);
          const merged: Task = { ...t, outputs: existing?.outputs ?? [] };
          const tasks = existing ? s.tasks.map((x) => (x.id === t.id ? merged : x)) : [merged, ...s.tasks];
          const activeTask = t.status === 'berjalan' ? t.id : s.activeTask === t.id ? undefined : s.activeTask;
          return { tasks, activeTask };
        }
      }
      return {};
    }),
}));
