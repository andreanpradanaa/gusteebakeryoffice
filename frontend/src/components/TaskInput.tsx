import { useState } from 'react';
import { api } from '../lib/api';
import { useOffice } from '../store/useOffice';

const SUGGESTIONS = [
  'Siapkan promo hampers Lebaran',
  'Buat promo Natal untuk kue kering',
  'Naikkan penjualan croissant 2 minggu ke depan',
  'Rencanakan menu spesial Valentine',
  'Siapkan hampers Imlek untuk pelanggan korporat',
];

export default function TaskInput() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = useOffice((s) => s.connected);
  const activeTask = useOffice((s) => s.activeTask);

  const submit = async (prompt: string) => {
    const p = prompt.trim();
    if (!p || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.submit(p);
      setText('');
      useOffice.getState().setTab('log');
      useOffice.getState().setSheetOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim perintah');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="shrink-0 border-t-4 border-crust-700 dark:border-crust-600 bg-cream-200 dark:bg-night-800 px-3 pb-3 pt-2">
      <div className="scroll-thin mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={!connected || sending}
            className="shrink-0 rounded-full border border-crust-600/30 dark:border-cream-300/20 bg-cream-50 dark:bg-night-700 px-2.5 py-1 text-xs hover:bg-peach-100 dark:hover:bg-night-900 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        className="flex items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-cream-50 dark:bg-night-900 pixel-border px-2.5">
          <span className="hidden font-pixel text-[9px] text-crust-500 sm:inline">👑 KE CEO:</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder={connected ? 'Beri perintah ke Owner CEO… mis. "Siapkan promo hampers Lebaran"' : 'Menunggu koneksi ke backend…'}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-crust-400/80"
            aria-label="Perintah untuk Owner CEO"
          />
        </div>
        <button
          type="submit"
          disabled={!connected || sending || !text.trim()}
          className="rounded-lg bg-crust-600 px-4 font-pixel text-[10px] text-cream-50 shadow-pixel hover:bg-crust-700 disabled:opacity-50 active:translate-y-px"
        >
          {sending ? '…' : 'KIRIM'}
        </button>
      </form>
      {(error || activeTask) && (
        <p className={`mt-1.5 text-xs ${error ? 'text-red-600 dark:text-red-400' : 'text-crust-500 dark:text-cream-300'}`}>
          {error ?? 'Tim sedang bekerja — perintah baru akan masuk antrean.'}
        </p>
      )}
    </div>
  );
}
