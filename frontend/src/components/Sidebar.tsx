import { useOffice, type Tab } from '../store/useOffice';
import { AGENTS, STATUS_LABEL } from '../config/agents';
import ActivityLog from './ActivityLog';
import KanbanBoard from './KanbanBoard';
import ResultsPanel from './ResultsPanel';
import DataPanel from './DataPanel';
import { AgentAvatar, StatusDot } from './common';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'log', label: 'Aktivitas', icon: '📜' },
  { id: 'kanban', label: 'Kanban', icon: '🗂️' },
  { id: 'hasil', label: 'Hasil Kerja', icon: '📦' },
  { id: 'data', label: 'Data', icon: '📊' },
];

function TeamStrip() {
  const agents = useOffice((s) => s.agents);
  return (
    <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-crust-600/15 dark:border-cream-300/10 px-2 py-1.5">
      {AGENTS.map((a) => {
        const st = agents[a.id]?.status ?? 'idle';
        return (
          <button
            key={a.id}
            onClick={() => useOffice.getState().selectAgent(a.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-cream-200 dark:hover:bg-night-700"
            title={`${a.name} — ${a.role}: ${STATUS_LABEL[st]}`}
          >
            <AgentAvatar id={a.id} size={22} />
            <div className="text-left leading-tight">
              <p className="text-[11px] font-semibold">{a.name}</p>
              <p className="flex items-center gap-1 text-[10px] text-crust-400"><StatusDot status={st} />{STATUS_LABEL[st]}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function Sidebar() {
  const tab = useOffice((s) => s.tab);
  const sheetOpen = useOffice((s) => s.sheetOpen);
  const { setTab, setSheetOpen } = useOffice.getState();

  const body = (
    <>
      <TeamStrip />
      <div className="min-h-0 flex-1">
        {tab === 'log' && <ActivityLog />}
        {tab === 'kanban' && <KanbanBoard />}
        {tab === 'hasil' && <ResultsPanel />}
        {tab === 'data' && <DataPanel />}
      </div>
    </>
  );

  const tabBar = (
    <nav className="flex border-b-4 border-crust-700 dark:border-crust-600 bg-cream-200 dark:bg-night-800">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => (tab === t.id && sheetOpen ? setSheetOpen(false) : setTab(t.id))}
          className={`flex-1 px-1 py-2.5 text-center text-[11px] font-semibold transition-colors sm:text-xs ${
            tab === t.id ? 'bg-cream-50 dark:bg-night-700 text-crust-800 dark:text-cream-100' : 'text-crust-500 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-night-700/60'
          }`}
        >
          <span className="mr-1">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop: sidebar kanan */}
      <aside className="hidden w-[400px] shrink-0 flex-col border-l-4 border-crust-700 dark:border-crust-600 bg-cream-100 dark:bg-night-800 lg:flex xl:w-[440px]">
        {tabBar}
        {body}
      </aside>

      {/* Mobile/tablet: bottom sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t-4 border-crust-700 dark:border-crust-600 bg-cream-100 dark:bg-night-800 shadow-[0_-8px_24px_rgba(0,0,0,0.18)] transition-[height] duration-300 lg:hidden ${
          sheetOpen ? 'h-[72dvh]' : 'h-[52px]'
        }`}
      >
        <button className="mx-auto mt-1.5 h-1.5 w-12 shrink-0 rounded-full bg-crust-400/50" onClick={() => setSheetOpen(!sheetOpen)} aria-label={sheetOpen ? 'Tutup panel' : 'Buka panel'} />
        <div className="overflow-hidden rounded-t-xl">{tabBar}</div>
        {sheetOpen && <div className="flex min-h-0 flex-1 flex-col">{body}</div>}
      </div>
    </>
  );
}
