import type { ServerEvent, Task } from './types';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

export const api = {
  tasks: () => fetch(`${BASE}/api/tasks`).then((r) => json<Task[]>(r)),
  submit: (prompt: string) =>
    fetch(`${BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }).then((r) => json<Task>(r)),
  data: <T>(kind: 'products' | 'ingredients' | 'recipes' | 'sales') =>
    fetch(`${BASE}/api/data/${kind}`).then((r) => json<T>(r)),
};

/** Berlangganan event kantor via SSE. EventSource otomatis reconnect. */
export function connectEvents(onEvent: (e: ServerEvent) => void, onStatus: (connected: boolean) => void) {
  const es = new EventSource(`${BASE}/api/events`);
  es.onopen = () => onStatus(true);
  es.onerror = () => onStatus(false);
  es.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data) as ServerEvent);
    } catch {
      /* abaikan event rusak */
    }
  };
  return () => es.close();
}
