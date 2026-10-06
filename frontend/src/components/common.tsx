import { useEffect, useMemo, useRef, useState } from 'react';
import { AGENT_BY_ID, agentColor, agentLabel } from '../config/agents';
import { drawCharacter, lookOf } from '../game/sprites';
import { copyText, downloadMarkdown, renderMarkdown } from '../lib/markdown';

/** Avatar pixel agen (digambar dengan sprite yang sama seperti di peta). */
export function AgentAvatar({ id, size = 40, anim = false }: { id: string; size?: number; anim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const v = AGENT_BY_ID[id];
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    c.width = 26;
    c.height = 28;
    c.style.width = `${size}px`;
    c.style.height = `${(size * 28) / 26}px`;
    let raf = 0;
    const draw = (now: number) => {
      ctx.clearRect(0, 0, 26, 28);
      if (v) {
        ctx.imageSmoothingEnabled = false;
        drawCharacter(ctx, 13, 26, lookOf(v), 'down', false, now / 1000, anim ? v.workAnims[0] : null);
      } else {
        ctx.fillStyle = agentColor(id);
        ctx.fillRect(6, 6, 14, 14);
      }
      if (anim) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [id, size, anim]);
  if (id === 'owner' || id === 'sistem') {
    return (
      <span
        className="inline-grid place-items-center rounded-lg text-sm"
        style={{ width: size, height: size, background: id === 'owner' ? '#FFD2BC' : '#E5E7EB' }}
      >
        {id === 'owner' ? '👑' : '⚙️'}
      </span>
    );
  }
  return <canvas ref={ref} className="[image-rendering:pixelated] shrink-0" />;
}

export function AgentChip({ id }: { id?: string }) {
  if (!id) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: agentColor(id) }}>
      {agentLabel(id)}
    </span>
  );
}

export function Markdown({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function CopyDownload({ content, filename }: { content: string; filename: string }) {
  const [copied, setCopied] = useState(false);
  const b = 'rounded-md border border-crust-600/30 dark:border-cream-300/20 px-2 py-1 text-xs font-medium hover:bg-peach-100 dark:hover:bg-night-700';
  return (
    <div className="flex gap-1.5">
      <button
        className={b}
        onClick={async () => {
          if (await copyText(content)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? '✓ Tersalin' : '📋 Salin'}
      </button>
      <button className={b} onClick={() => downloadMarkdown(filename, content)}>
        ⬇️ Unduh .md
      </button>
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const c = { idle: '#9CA3AF', thinking: '#F2C14E', working: '#5FAE78', meeting: '#E57F84' }[status] ?? '#9CA3AF';
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {status !== 'idle' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: c }} />}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: c }} />
    </span>
  );
}
