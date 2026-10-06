export type AgentStatus = 'idle' | 'thinking' | 'working' | 'meeting';

export interface LogEntry {
  id: string;
  taskId?: string;
  from: string;
  to?: string;
  text: string;
  kind: 'perintah' | 'pesan' | 'tanya' | 'jawab' | 'sistem' | 'hasil';
  time: number;
}

export type KanbanColumn = 'todo' | 'progress' | 'review' | 'done';

export interface KanbanCard {
  id: string;
  taskId: string;
  title: string;
  agent: string;
  column: KanbanColumn;
  updatedAt: number;
}

export interface Output {
  id: string;
  taskId: string;
  agent: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface Task {
  id: string;
  prompt: string;
  status: 'antre' | 'berjalan' | 'selesai' | 'gagal';
  mode: 'demo' | 'llm';
  createdAt: number;
  finishedAt?: number;
  summary?: string;
  outputs: Output[];
}

export interface AgentState {
  id: string;
  status: AgentStatus;
  room: string;
  activity: string;
  taskId?: string;
}

export interface Snapshot {
  mode: 'demo' | 'llm';
  model?: string;
  agents: Record<string, AgentState>;
  cards: KanbanCard[] | null;
  logs: LogEntry[] | null;
  activeTask?: string;
}

export interface ServerEvent {
  type: 'snapshot' | 'agent' | 'bubble_start' | 'bubble_delta' | 'bubble_end' | 'log' | 'card' | 'output' | 'task';
  taskId?: string;
  agent?: string;
  status?: AgentStatus;
  room?: string;
  activity?: string;
  msgId?: string;
  text?: string;
  log?: LogEntry;
  card?: KanbanCard;
  output?: Output;
  task?: Task;
  snapshot?: Snapshot;
  time: number;
}
