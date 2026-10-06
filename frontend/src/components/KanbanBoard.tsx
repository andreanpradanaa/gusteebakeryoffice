import { useMemo } from 'react';
import { agentColor, agentLabel } from '../config/agents';
import type { KanbanColumn } from '../lib/types';
import { useOffice } from '../store/useOffice';
import { AgentAvatar } from './common';

const COLUMNS: { id: KanbanColumn; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: '#F7DC6F' },
  { id: 'progress', label: 'In Progress', color: '#FFB89A' },
  { id: 'review', label: 'Review', color: '#AED6F1' },
  { id: 'done', label: 'Done', color: '#B8E0C2' },
];

export default function KanbanBoard() {
  const cards = useOffice((s) => s.cards);
  const tasks = useOffice((s) => s.tasks);
  const prompts = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t.prompt])), [tasks]);
  // tampilkan kartu dari 3 tugas terakhir
  const recentTasks = useMemo(() => {
    const ids: string[] = [];
    for (let i = cards.length - 1; i >= 0 && ids.length < 3; i--) if (!ids.includes(cards[i].taskId)) ids.push(cards[i].taskId);
    return ids;
  }, [cards]);
  const visible = cards.filter((c) => recentTasks.includes(c.taskId));

  return (
    <div className="scroll-thin flex h-full gap-2 overflow-x-auto p-2">
      {COLUMNS.map((col) => {
        const items = visible.filter((c) => c.column === col.id).sort((a, b) => b.updatedAt - a.updatedAt);
        return (
          <div key={col.id} className="flex w-[46%] min-w-[150px] shrink-0 flex-col rounded-lg bg-cream-200/70 dark:bg-night-700/60 lg:w-auto lg:flex-1 lg:shrink">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: col.color }} />
              <span className="font-pixel text-[8px] uppercase">{col.label}</span>
              <span className="ml-auto rounded bg-cream-50 dark:bg-night-900 px-1.5 text-[10px] font-semibold">{items.length}</span>
            </div>
            <div className="scroll-thin flex-1 space-y-1.5 overflow-y-auto px-1.5 pb-2">
              {items.map((c) => (
                <div
                  key={c.id}
                  className="animate-pop rounded-md bg-cream-50 dark:bg-night-900 p-2 shadow-sm"
                  style={{ borderLeft: `4px solid ${agentColor(c.agent)}` }}
                >
                  <p className="text-[12px] font-semibold leading-snug">{c.title}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <AgentAvatar id={c.agent} size={16} />
                    <span className="truncate text-[10px] text-crust-500 dark:text-cream-300">{agentLabel(c.agent)}</span>
                  </div>
                  {prompts[c.taskId] && (
                    <p className="mt-1 truncate text-[10px] italic text-crust-400" title={prompts[c.taskId]}>
                      “{prompts[c.taskId]}”
                    </p>
                  )}
                </div>
              ))}
              {items.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-crust-400">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
