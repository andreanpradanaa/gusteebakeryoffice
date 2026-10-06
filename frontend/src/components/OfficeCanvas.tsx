import { useEffect, useRef } from 'react';
import { Engine } from '../game/engine';
import { COLS, ROWS, TILE } from '../game/map';
import { Renderer, type Camera } from '../game/renderer';
import { useOffice } from '../store/useOffice';
import type { Phase } from '../lib/time';

interface Props {
  phase: Phase;
  dark: boolean;
}

const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

export default function OfficeCanvas({ phase, dark }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Camera>({ scale: 2, ox: 0, oy: 0 });
  const engine = useRef<Engine>();
  const renderer = useRef<Renderer>();
  const view = useRef({ w: 0, h: 0 });
  const userMoved = useRef(false);
  const env = useRef({ phase, dark });
  env.current = { phase, dark };

  const fit = () => {
    const { w, h } = view.current;
    if (!w || !h) return;
    const scale = Math.max(0.6, Math.min(w / WORLD_W, h / WORLD_H) * 0.98);
    // di layar sempit, perbesar agar karakter terbaca (peta bisa digeser)
    const s = w < 640 ? Math.max(scale, 1.35) : scale;
    cam.current = { scale: s, ox: (w - WORLD_W * s) / 2, oy: Math.max(0, (h - WORLD_H * s) / 2) };
    if (w < 640) cam.current.ox = Math.min(0, Math.max(w - WORLD_W * s, -(WORLD_W * s - w) / 2));
    clamp();
  };

  const clamp = () => {
    const { w, h } = view.current;
    const c = cam.current;
    const ww = WORLD_W * c.scale, wh = WORLD_H * c.scale;
    const pad = 80;
    c.ox = ww <= w ? (w - ww) / 2 : Math.min(pad, Math.max(w - ww - pad, c.ox));
    c.oy = wh <= h ? (h - wh) / 2 : Math.min(pad, Math.max(h - wh - pad, c.oy));
  };

  const zoomAt = (factor: number, sx: number, sy: number) => {
    const c = cam.current;
    const ns = Math.max(0.5, Math.min(5, c.scale * factor));
    const wx = (sx - c.ox) / c.scale, wy = (sy - c.oy) / c.scale;
    c.scale = ns;
    c.ox = sx - wx * ns;
    c.oy = sy - wy * ns;
    userMoved.current = true;
    clamp();
  };

  useEffect(() => {
    engine.current = new Engine();
    renderer.current = new Renderer();
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.current = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      renderer.current!.dpr = dpr;
      if (!userMoved.current) fit();
      else clamp();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = useOffice.getState();
      const busy = !!s.activeTask || Object.values(s.agents).some((a) => a.status !== 'idle');
      engine.current!.update(dt, s.agents, env.current.phase, busy);
      renderer.current!.draw(
        ctx, cam.current, view.current.w, view.current.h, now / 1000,
        [...engine.current!.chars, ...engine.current!.npcs], s.agents, s.cards,
        env.current.phase, env.current.dark, s.selectedAgent,
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ---------- pan, zoom, klik ----------
    const pointers = new Map<number, { x: number; y: number }>();
    let downAt: { x: number; y: number; t: number } | null = null;
    let pinchDist = 0;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) downAt = { ...p, t: performance.now() };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        downAt = null;
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        const w = cam.current;
        const hover = engine.current!.hit((p.x - w.ox) / w.scale, (p.y - w.oy) / w.scale);
        canvas.style.cursor = hover ? 'pointer' : 'grab';
        return;
      }
      if (pointers.size === 2) {
        pointers.set(e.pointerId, p);
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) zoomAt(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinchDist = d;
        return;
      }
      cam.current.ox += p.x - prev.x;
      cam.current.oy += p.y - prev.y;
      pointers.set(e.pointerId, p);
      if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 6) {
        userMoved.current = true;
        canvas.style.cursor = 'grabbing';
      }
      clamp();
    };
    const onUp = (e: PointerEvent) => {
      const p = local(e);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) <= 6) {
        const w = cam.current;
        const id = engine.current!.hit((p.x - w.ox) / w.scale, (p.y - w.oy) / w.scale);
        useOffice.getState().selectAgent(id);
      }
      downAt = null;
      canvas.style.cursor = 'grab';
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const btn =
    'w-9 h-9 grid place-items-center rounded-lg bg-cream-50/90 dark:bg-night-800/90 border-2 border-crust-700/40 dark:border-crust-300/30 text-crust-800 dark:text-cream-200 shadow-pixel font-pixel text-xs active:translate-y-px';

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden select-none">
      <canvas ref={canvasRef} className="block touch-none cursor-grab" aria-label="Peta kantor Gustee Bakery" />
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button className={btn} onClick={() => zoomAt(1.25, view.current.w / 2, view.current.h / 2)} title="Perbesar">+</button>
        <button className={btn} onClick={() => zoomAt(0.8, view.current.w / 2, view.current.h / 2)} title="Perkecil">−</button>
        <button className={btn} onClick={() => { userMoved.current = false; fit(); }} title="Pas layar">⤢</button>
      </div>
      <div className="pointer-events-none absolute left-3 bottom-3 rounded-lg bg-cream-50/85 dark:bg-night-800/85 px-2.5 py-1.5 text-[11px] text-crust-700 dark:text-cream-300 shadow">
        Geser peta • scroll/pinch untuk zoom • klik karakter untuk detail
      </div>
    </div>
  );
}
