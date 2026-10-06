import { useEffect, useState } from 'react';
import { useOffice, type ThemePref } from '../store/useOffice';
import { PHASE_LABEL, type Phase } from '../lib/time';

const clock = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', weekday: 'short' });

export default function Header({ phase }: { phase: Phase }) {
  const connected = useOffice((s) => s.connected);
  const mode = useOffice((s) => s.mode);
  const model = useOffice((s) => s.model);
  const themePref = useOffice((s) => s.themePref);
  const setThemePref = useOffice((s) => s.setThemePref);
  const phaseOverride = useOffice((s) => s.phaseOverride);
  const setPhaseOverride = useOffice((s) => s.setPhaseOverride);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const nextTheme: Record<ThemePref, ThemePref> = { auto: 'light', light: 'dark', dark: 'auto' };
  const themeLabel: Record<ThemePref, string> = { auto: '🌓 Auto', light: '☀️ Terang', dark: '🌙 Gelap' };

  return (
    <header className="flex shrink-0 items-center gap-x-2 gap-y-1.5 border-b-4 border-crust-700 dark:border-crust-600 bg-cream-200 dark:bg-night-800 px-3 py-2 md:px-4">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-crust-600 text-base shadow-pixel sm:h-9 sm:w-9 sm:text-lg">🥐</div>
        <div className="leading-tight">
          <h1 className="font-pixel text-[9px] text-crust-800 dark:text-cream-200 sm:text-sm">GUSTEE BAKERY</h1>
          <p className="hidden font-pixel text-[8px] text-crust-500 sm:block dark:text-peach-300 sm:text-[9px]">OFFICE · TIM AI</p>
        </div>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-1 text-[11px] sm:gap-1.5 sm:text-xs">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-cream-50 dark:bg-night-700 px-2 py-1 font-medium sm:px-2.5"
          title={connected ? 'Terhubung ke backend' : 'Backend tidak terhubung — jalankan server Go'}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-mint-500' : 'bg-red-400 animate-pulse'}`} />
          <span className="hidden sm:inline">{connected ? (mode === 'llm' ? `Claude · ${model ?? ''}` : 'Mode Demo') : 'Terputus'}</span>
          <span className="sm:hidden">{connected ? (mode === 'llm' ? 'LLM' : 'Demo') : 'Off'}</span>
        </span>
        <label className="inline-flex items-center gap-1 rounded-full bg-cream-50 dark:bg-night-700 px-2 py-1 sm:px-2.5" title="Waktu WIB — pilih ⏱ untuk mengatur suasana secara manual">
          <span className="hidden font-semibold tabular-nums sm:inline">{clock.format(now)} WIB</span>
          <select
            aria-label="Waktu di kantor"
            className="max-w-[92px] bg-transparent text-[11px] outline-none sm:max-w-none sm:text-xs"
            value={phaseOverride}
            onChange={(e) => setPhaseOverride(e.target.value as Phase | 'auto')}
          >
            <option value="auto">{PHASE_LABEL[phase]}</option>
            {(Object.keys(PHASE_LABEL) as Phase[]).map((p) => (
              <option key={p} value={p}>
                ⏱ {PHASE_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="shrink-0 rounded-full bg-cream-50 dark:bg-night-700 px-2 py-1 font-medium sm:px-2.5 hover:bg-peach-100 dark:hover:bg-night-900"
          onClick={() => setThemePref(nextTheme[themePref])}
          title="Ganti tema (Auto mengikuti jam WIB)"
        >
          <span className="sm:hidden">{themeLabel[themePref].split(' ')[0]}</span>
          <span className="hidden sm:inline">{themeLabel[themePref]}</span>
        </button>
      </div>
    </header>
  );
}
