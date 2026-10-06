import { useEffect, useState } from 'react';
import Header from './components/Header';
import OfficeCanvas from './components/OfficeCanvas';
import TaskInput from './components/TaskInput';
import Sidebar from './components/Sidebar';
import AgentPanel from './components/AgentPanel';
import { api, connectEvents } from './lib/api';
import { phaseOf, wibHour, type Phase } from './lib/time';
import { useOffice } from './store/useOffice';

export default function App() {
  const themePref = useOffice((s) => s.themePref);
  const phaseOverride = useOffice((s) => s.phaseOverride);
  const [realPhase, setRealPhase] = useState<Phase>(() => phaseOf(wibHour()));

  // Siklus pagi/siang/sore/malam mengikuti jam WIB
  useEffect(() => {
    const id = setInterval(() => setRealPhase(phaseOf(wibHour())), 30000);
    return () => clearInterval(id);
  }, []);

  const phase = phaseOverride === 'auto' ? realPhase : phaseOverride;
  const dark = themePref === 'dark' || (themePref === 'auto' && phase === 'malam');
  // Mode gelap = suasana bakery malam hari
  const mapPhase: Phase = themePref === 'dark' ? 'malam' : phase;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1E1826' : '#FFF6E9');
  }, [dark]);

  // Koneksi realtime ke backend
  useEffect(() => {
    const { applyEvent, setConnected, setTasks } = useOffice.getState();
    const loadTasks = () => api.tasks().then(setTasks).catch(() => undefined);
    loadTasks();
    return connectEvents(
      (e) => {
        if (e.type === 'snapshot') loadTasks();
        applyEvent(e);
      },
      setConnected,
    );
  }, []);

  return (
    <div className="scroll-thin flex h-[100dvh] flex-col overflow-y-auto">
      <Header phase={phase} />
      <main className="flex min-h-[340px] flex-1">
        <section className="flex min-w-0 flex-1 flex-col pb-[52px] lg:pb-0">
          <div className="min-h-[200px] flex-1">
            <OfficeCanvas phase={mapPhase} dark={dark} />
          </div>
          <TaskInput />
        </section>
        <Sidebar />
      </main>
      <AgentPanel />
    </div>
  );
}
