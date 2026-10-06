import { useMemo, useState } from 'react';
import { AGENT_BY_ID, STATUS_LABEL } from '../config/agents';
import { ROOM_BY_ID } from '../game/map';
import { formatDateTime } from '../lib/time';
import { useOffice } from '../store/useOffice';
import { AgentAvatar, CopyDownload, Markdown, StatusDot } from './common';

const PROFILE: Record<string, string[]> = {
  ceo: ['Menerima perintah dari owner', 'Memecah perintah jadi sub-tugas & membagikannya', 'Memimpin rapat koordinasi', 'Merangkum hasil menjadi rencana akhir'],
  marketing: ['Strategi promo: bundling, diskon, promo musiman', 'Caption Instagram & TikTok', 'Ide video Reels', 'Jadwal posting'],
  finance: ['Rekap omzet', 'Hitung HPP per produk', 'Margin & rekomendasi harga jual', 'Proyeksi laba promo'],
  rnd: ['Mengelola resep standar', 'Scaling porsi & costing resep', 'Mengusulkan menu/varian baru'],
  ops: ['Rencana produksi harian', 'Memantau stok bahan & kemasan', 'Daftar belanja ke supplier'],
};

export default function AgentPanel() {
  const id = useOffice((s) => s.selectedAgent);
  const agent = useOffice((s) => (id ? s.agents[id] : undefined));
  const tasks = useOffice((s) => s.tasks);
  const close = () => useOffice.getState().selectAgent(null);
  const [openOut, setOpenOut] = useState<string | null>(null);

  const history = useMemo(
    () =>
      tasks
        .flatMap((t) => t.outputs.filter((o) => o.agent === id).map((o) => ({ ...o, prompt: t.prompt })))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 12),
    [tasks, id],
  );

  if (!id) return null;
  const v = AGENT_BY_ID[id];
  const room = agent?.room ? ROOM_BY_ID[agent.room]?.name : undefined;
  const bubble = agent?.bubble;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/25" onClick={close}>
      <aside
        className="animate-pop scroll-thin flex h-full w-full max-w-md flex-col overflow-y-auto bg-cream-100 dark:bg-night-800 shadow-2xl sm:border-l-4 sm:border-crust-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Detail ${v?.name ?? id}`}
      >
        <div className="flex items-start gap-3 border-b-4 border-crust-700/80 bg-cream-200 dark:bg-night-700 p-4">
          <div className="rounded-lg bg-cream-50 dark:bg-night-900 p-1.5 pixel-border">
            <AgentAvatar id={id} size={64} anim={agent?.status === 'working'} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-pixel text-xs leading-relaxed">{v?.name ?? id}</h2>
            <p className="text-sm font-semibold" style={{ color: v?.color }}>{v?.role}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs">
              <StatusDot status={agent?.status ?? 'idle'} />
              {STATUS_LABEL[agent?.status ?? 'idle']}
              {room && <span className="text-crust-400">· di {room}</span>}
            </p>
          </div>
          <button onClick={close} className="rounded-md px-2 py-1 text-lg hover:bg-cream-300 dark:hover:bg-night-900" aria-label="Tutup">✕</button>
        </div>

        <div className="space-y-4 p-4 text-sm">
          <section>
            <h3 className="mb-1 font-pixel text-[9px] text-crust-600 dark:text-peach-300">TUGAS SAAT INI</h3>
            <p>{agent?.activity || <span className="text-crust-400">Tidak ada tugas — sedang santai di {ROOM_BY_ID[v?.home ?? '']?.name}.</span>}</p>
            {bubble && bubble.text && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-crust-600/15 bg-cream-50 dark:bg-night-900 p-2.5 scroll-thin">
                <p className="mb-1 text-[10px] font-semibold uppercase text-crust-400">{bubble.done ? 'Pesan terakhir' : '● Sedang mengetik…'}</p>
                <Markdown content={bubble.text} />
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-1 font-pixel text-[9px] text-crust-600 dark:text-peach-300">PROFIL & TANGGUNG JAWAB</h3>
            <ul className="list-disc space-y-0.5 pl-5">
              {(PROFILE[id] ?? ['Agen tambahan Gustee Bakery']).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-crust-400">Ruang kerja: {ROOM_BY_ID[v?.home ?? '']?.name ?? '-'}</p>
          </section>

          <section>
            <h3 className="mb-1.5 font-pixel text-[9px] text-crust-600 dark:text-peach-300">RIWAYAT OUTPUT ({history.length})</h3>
            {history.length === 0 && <p className="text-crust-400">Belum ada output.</p>}
            <ul className="space-y-1.5">
              {history.map((o) => (
                <li key={o.id} className="rounded-lg border border-crust-600/15">
                  <button className="w-full px-2.5 py-2 text-left" onClick={() => setOpenOut(openOut === o.id ? null : o.id)}>
                    <p className="text-[13px] font-semibold">{o.title}</p>
                    <p className="truncate text-[11px] text-crust-400">{formatDateTime(o.createdAt)} · “{o.prompt}”</p>
                  </button>
                  {openOut === o.id && (
                    <div className="border-t border-crust-600/10 px-3 py-2">
                      <div className="mb-2 flex justify-end"><CopyDownload content={o.content} filename={`${id}-${o.title}`} /></div>
                      <Markdown content={o.content} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
