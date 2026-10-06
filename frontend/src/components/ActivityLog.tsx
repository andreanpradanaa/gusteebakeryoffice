import { useEffect, useRef, useState } from 'react';
import { agentLabel } from '../config/agents';
import { formatTime } from '../lib/time';
import type { LogEntry } from '../lib/types';
import { useOffice } from '../store/useOffice';
import { AgentAvatar } from './common';

const KIND: Record<LogEntry['kind'], { icon: string; cls: string; verb: string }> = {
  perintah: { icon: '📋', cls: 'bg-peach-100/70 dark:bg-peach-400/10', verb: 'memberi tugas' },
  pesan: { icon: '💬', cls: '', verb: '' },
  tanya: { icon: '❓', cls: 'bg-sky-50 dark:bg-sky-400/10', verb: 'bertanya' },
  jawab: { icon: '💡', cls: 'bg-mint-100/70 dark:bg-mint-400/10', verb: 'menjawab' },
  hasil: { icon: '✅', cls: 'bg-cream-200/70 dark:bg-night-700/60', verb: '' },
  sistem: { icon: '⚙️', cls: 'opacity-80', verb: '' },
};

function Entry({ l }: { l: LogEntry }) {
  const [open, setOpen] = useState(false);
  const k = KIND[l.kind] ?? KIND.pesan;
  const long = l.text.length > 220;
  return (
    <li className={`flex gap-2 rounded-lg px-2 py-2 ${k.cls}`}>
      <AgentAvatar id={l.from} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1 text-xs">
          <span className="font-semibold">{agentLabel(l.from)}</span>
          {l.to && (
            <>
              <span className="text-crust-400">→</span>
              <span className="font-semibold">{agentLabel(l.to)}</span>
            </>
          )}
          <span className="ml-auto shrink-0 tabular-nums text-[10px] text-crust-400">{formatTime(l.time)}</span>
        </div>
        <p className={`mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug ${!open && long ? 'line-clamp-4' : ''}`}>
          <span className="mr-1">{k.icon}</span>
          {l.text}
        </p>
        {long && (
          <button className="mt-0.5 text-[11px] font-medium text-crust-500 hover:underline" onClick={() => setOpen(!open)}>
            {open ? 'Ringkas' : 'Lihat semua'}
          </button>
        )}
      </div>
    </li>
  );
}

export default function ActivityLog() {
  const logs = useOffice((s) => s.logs);
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div
      ref={ref}
      className="scroll-thin h-full overflow-y-auto p-2"
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      }}
    >
      {logs.length === 0 ? (
        <div className="grid h-full place-items-center p-6 text-center text-sm text-crust-500 dark:text-cream-300">
          <div>
            <div className="mb-2 text-3xl">🧁</div>
            Belum ada aktivitas. Beri perintah ke Owner CEO di bawah peta, mis. <b>“Siapkan promo hampers Lebaran.”</b>
          </div>
        </div>
      ) : (
        <ul className="space-y-1">
          {logs.map((l) => (
            <Entry key={l.id} l={l} />
          ))}
        </ul>
      )}
    </div>
  );
}
