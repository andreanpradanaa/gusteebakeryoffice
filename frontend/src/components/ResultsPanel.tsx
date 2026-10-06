import { useState } from 'react';
import { AGENT_BY_ID, agentLabel } from '../config/agents';
import { slugify, downloadMarkdown } from '../lib/markdown';
import { formatDateTime } from '../lib/time';
import type { Output, Task } from '../lib/types';
import { useOffice } from '../store/useOffice';
import { AgentAvatar, CopyDownload, Markdown } from './common';

const STATUS: Record<Task['status'], string> = {
  antre: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  berjalan: 'bg-peach-200 text-crust-800 dark:bg-peach-400/30 dark:text-peach-100',
  selesai: 'bg-mint-200 text-mint-500 dark:bg-mint-400/20 dark:text-mint-200',
  gagal: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function OutputBlock({ o, defaultOpen }: { o: Output; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const name = AGENT_BY_ID[o.agent]?.name;
  return (
    <div className={`rounded-lg border ${o.agent === 'ceo' ? 'border-crust-500/50 bg-cream-50 dark:bg-night-900' : 'border-crust-600/15 dark:border-cream-300/10'}`}>
      <button className="flex w-full items-center gap-2 px-2.5 py-2 text-left" onClick={() => setOpen(!open)}>
        <AgentAvatar id={o.agent} size={22} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{o.agent === 'ceo' ? '⭐ ' : ''}{o.title}</p>
          <p className="text-[11px] text-crust-400">{name ? `${name} · ` : ''}{agentLabel(o.agent)}</p>
        </div>
        <span className="text-xs text-crust-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-crust-600/10 dark:border-cream-300/10 px-3 py-2.5">
          <div className="mb-2 flex justify-end">
            <CopyDownload content={o.content} filename={`${slugify(o.title)}-${o.agent}`} />
          </div>
          <Markdown content={o.content} />
        </div>
      )}
    </div>
  );
}

function combined(t: Task): string {
  const order = [...t.outputs].sort((a, b) => (a.agent === 'ceo' ? -1 : b.agent === 'ceo' ? 1 : a.createdAt - b.createdAt));
  return [
    `# Gustee Bakery — ${t.prompt}`,
    `_Dibuat ${formatDateTime(t.createdAt)} WIB · mode ${t.mode === 'llm' ? 'Claude' : 'demo'}_`,
    ...order.map((o) => `\n---\n\n# ${o.title}\n_oleh ${agentLabel(o.agent)}_\n\n${o.content}`),
  ].join('\n');
}

export default function ResultsPanel() {
  const tasks = useOffice((s) => s.tasks);
  const expanded = useOffice((s) => s.expandedTask);
  const setExpanded = useOffice((s) => s.setExpandedTask);

  if (tasks.length === 0)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-sm text-crust-500 dark:text-cream-300">
        <div>
          <div className="mb-2 text-3xl">📜</div>
          Hasil kerja tim akan muncul di sini — bisa dibaca, disalin, atau diunduh sebagai Markdown.
        </div>
      </div>
    );

  return (
    <div className="scroll-thin h-full space-y-2 overflow-y-auto p-2">
      {tasks.map((t, i) => {
        const open = expanded ? expanded === t.id : i === 0;
        const final = t.outputs.find((o) => o.agent === 'ceo');
        const others = t.outputs.filter((o) => o.agent !== 'ceo');
        return (
          <article key={t.id} className="rounded-xl bg-cream-200/60 dark:bg-night-700/50 p-2.5">
            <button className="flex w-full items-start gap-2 text-left" onClick={() => setExpanded(open ? '__none__' : t.id)}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">“{t.prompt}”</p>
                <p className="mt-0.5 text-[11px] text-crust-400">
                  {formatDateTime(t.createdAt)} · {t.mode === 'llm' ? 'Claude' : 'Demo'} · {t.outputs.length} hasil
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS[t.status]}`}>{t.status}</span>
            </button>
            {open && (
              <div className="mt-2 space-y-1.5">
                {t.outputs.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      className="rounded-md bg-crust-600 px-2.5 py-1 text-xs font-medium text-cream-50 hover:bg-crust-700"
                      onClick={() => downloadMarkdown(`gustee-${slugify(t.prompt)}`, combined(t))}
                    >
                      ⬇️ Unduh semua (.md)
                    </button>
                  </div>
                )}
                {final && <OutputBlock o={final} defaultOpen />}
                {others.map((o) => (
                  <OutputBlock key={o.id} o={o} />
                ))}
                {t.status === 'berjalan' && (
                  <p className="px-1 text-xs italic text-crust-400">Tim masih bekerja… hasil akan muncul satu per satu.</p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
