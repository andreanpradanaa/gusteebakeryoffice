// Sprite pixel-art yang digambar langsung lewat kode (tanpa file gambar).
import type { AgentVisual, WorkAnim } from '../config/agents';
import type { Face } from './map';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: AgentVisual['hairStyle'];
  shirt: string;
  apron: string;
  accessory: AgentVisual['accessory'];
  pants?: string;
}

const PANTS = '#3B2A1D';
const SHOE = '#24170E';
const EYE = '#2A1B12';

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/**
 * Gambar karakter 12×21 px dengan titik jangkar di kaki (x,y).
 * frame: 0/1 untuk langkah kaki; anim: animasi kerja (opsional).
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  look: Look,
  face: Face,
  walking: boolean,
  t: number,
  anim: WorkAnim | null,
) {
  const ox = Math.round(x - 6);
  const step = walking ? Math.floor(t * 8) % 2 : 0;
  const bob = walking ? (step ? 1 : 0) : anim ? (Math.floor(t * 4) % 2) * 0 : Math.round(Math.sin(t * 2) * 0.4);
  const oy = Math.round(y - 21 + bob);
  const p = (px: number, py: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + px, oy + py, w, h);
  };

  // bayangan
  ctx.fillStyle = 'rgba(40,25,10,0.25)';
  ctx.fillRect(Math.round(x - 5), Math.round(y - 1), 10, 2);
  ctx.fillRect(Math.round(x - 4), Math.round(y - 2), 8, 1);

  const mirror = face === 'left';
  if (mirror) {
    ctx.save();
    ctx.translate(Math.round(x) * 2, 0);
    ctx.scale(-1, 1);
  }
  const side = face === 'left' || face === 'right';
  const back = face === 'up';
  const pants = look.pants ?? PANTS;

  // kaki
  if (side) {
    const a = walking ? (step ? 2 : -1) : 0;
    p(4 + Math.max(0, a), 16, 2, 4, pants);
    p(6 - Math.max(0, -a), 16, 2, 4, shade(pants, -15));
    p(4 + Math.max(0, a), 20, 3, 1, SHOE);
    p(6 - Math.max(0, -a), 20, 3, 1, SHOE);
  } else {
    p(3, 16, 2, step === 1 ? 3 : 4, pants);
    p(7, 16, 2, step === 0 && walking ? 3 : 4, pants);
    p(3, step === 1 ? 19 : 20, 2, 1, SHOE);
    p(7, step === 0 && walking ? 19 : 20, 2, 1, SHOE);
  }

  // badan
  p(2, 9, 8, 7, look.shirt);
  p(2, 15, 8, 1, shade(look.shirt, -25));
  if (!back) {
    p(3, 10, 6, 6, look.apron); // celemek
    p(3, 9, 1, 1, look.apron);
    p(8, 9, 1, 1, look.apron);
    if (!side) p(4, 13, 4, 1, shade(look.apron, -20)); // saku
  } else {
    p(5, 10, 2, 1, look.apron); // tali celemek di punggung
    p(4, 11, 4, 1, look.apron);
  }
  if (look.accessory === 'tie' && !back) {
    p(5, 9, 2, 1, '#7A2E2E');
    p(5, 10, 2, 3, '#9B3B3B');
  }

  // lengan & tangan (animasi kerja)
  let la = 0, ra = 0; // offset naik tangan
  const fast = Math.floor(t * 10) % 2;
  const slow = Math.floor(t * 4) % 2;
  if (!walking && anim) {
    if (anim === 'typing') { la = fast ? 2 : 0; ra = fast ? 0 : 2; }
    else if (anim === 'stirring') { ra = 2 + slow; la = 1; }
    else if (anim === 'kneading') { la = ra = slow ? 3 : 1; }
    else if (anim === 'filming') { la = ra = 4; }
    else if (anim === 'counting') { ra = slow ? 3 : 1; }
    else if (anim === 'checking') { ra = slow ? 6 : 4; }
  }
  if (side) {
    p(5, 10 - Math.min(ra, 3), 2, 4, shade(look.shirt, -15));
    p(walking ? 5 + (step ? 1 : -1) : 6, 14 - Math.min(ra, 3) - (ra > 3 ? 1 : 0), 2, 1, look.skin);
  } else {
    p(1, 10 - la, 1, 4, shade(look.shirt, -15));
    p(10, 10 - ra, 1, 4, shade(look.shirt, -15));
    p(1, 14 - la, 1, 1, look.skin);
    p(10, 14 - ra, 1, 1, look.skin);
  }

  // kepala
  p(3, 2, 6, 7, look.skin);
  p(3, 8, 6, 1, shade(look.skin, -20));
  if (!back) {
    if (side) {
      p(7, 5, 1, 1, EYE);
      p(9, 5, 1, 2, look.skin); // hidung
    } else {
      const blink = Math.floor(t * 0.7 + x) % 7 === 0 && (t * 10) % 10 < 1.5;
      p(4, 5, 1, blink ? 0.5 : 1, EYE);
      p(7, 5, 1, blink ? 0.5 : 1, EYE);
      p(5, 7, 2, 1, shade(look.skin, -35));
      p(3, 6, 1, 1, 'rgba(255,120,120,0.35)');
      p(8, 6, 1, 1, 'rgba(255,120,120,0.35)');
    }
  }

  // rambut
  const h = look.hair;
  switch (look.hairStyle) {
    case 'short':
      p(3, 1, 6, 2, h); p(2, 2, 1, 3, h); p(9, 2, 1, 3, h);
      if (back) p(3, 3, 6, 4, h);
      break;
    case 'long':
      p(3, 1, 6, 2, h); p(2, 2, 1, 8, h); p(9, 2, 1, 8, h); p(3, 3, 1, 1, h); p(8, 3, 1, 1, h);
      if (back) p(3, 3, 6, 7, h);
      break;
    case 'bun':
      p(3, 1, 6, 2, h); p(2, 2, 1, 3, h); p(9, 2, 1, 3, h); p(5, -1, 3, 2, shade(h, 10));
      if (back) p(3, 3, 6, 4, h);
      break;
    case 'curly':
      p(2, 1, 8, 2, h); p(3, 0, 2, 1, h); p(6, 0, 2, 1, h); p(2, 3, 1, 2, h); p(9, 3, 1, 2, h);
      if (back) p(2, 3, 8, 4, h);
      break;
    case 'bald':
      p(2, 4, 1, 2, h); p(9, 4, 1, 2, h);
      if (back) p(3, 5, 6, 2, h);
      break;
  }

  // aksesori
  switch (look.accessory) {
    case 'chefhat':
      p(3, -1, 6, 3, '#FFFFFF'); p(2, -3, 8, 2, '#FFFFFF'); p(3, -4, 6, 1, '#FFFFFF'); p(3, 1, 6, 1, '#E6E6E6');
      break;
    case 'beret':
      p(2, 0, 7, 2, '#C2185B'); p(3, -1, 4, 1, '#C2185B'); p(6, -2, 1, 1, '#8E1043');
      break;
    case 'glasses':
      if (!back) {
        if (side) p(6, 5, 3, 1, '#222');
        else { p(3, 5, 2, 1, '#222'); p(7, 5, 2, 1, '#222'); p(5, 5, 2, 1, '#555'); }
      }
      break;
    case 'bandana':
      p(2, 1, 8, 1, '#5FAE78'); p(3, 0, 6, 1, '#5FAE78');
      if (back) p(5, 2, 2, 2, '#3F7D57');
      break;
  }

  // properti animasi kerja (di depan karakter)
  if (!walking && anim) drawProp(ctx, ox, oy, anim, t, face);

  if (mirror) ctx.restore();
}

function drawProp(ctx: CanvasRenderingContext2D, ox: number, oy: number, anim: WorkAnim, t: number, face: Face) {
  const p = (px: number, py: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + px, oy + py, w, h);
  };
  const front = face === 'down';
  switch (anim) {
    case 'stirring': {
      if (!front) break;
      p(2, 19, 8, 3, '#E9E2D0'); p(3, 22, 6, 1, '#CFC6B0'); p(3, 19, 6, 1, '#F3DFA9');
      const a = t * 6;
      const sx = 6 + Math.round(Math.cos(a) * 2), sy = 19 + Math.round(Math.sin(a) * 0.6);
      p(sx, sy - 4, 1, 4, '#8B5A2B');
      break;
    }
    case 'kneading': {
      if (!front) break;
      const sq = Math.floor(t * 4) % 2;
      p(2 - sq, 20, 8 + sq * 2, 2 - sq * 0, '#F5DEB3'); p(3, 19 + sq, 6, 1, '#FBEBC9');
      break;
    }
    case 'filming': {
      p(8, 5, 3, 5, '#222'); p(9, 6, 1, 3, '#7FD3FF');
      if (Math.floor(t * 2) % 2) p(10, 4, 1, 1, '#FF4D4D');
      break;
    }
    case 'counting': {
      const bounce = Math.floor(t * 3) % 3;
      p(9, 12 - bounce, 2, 2, '#F2C14E'); p(9, 12 - bounce, 1, 1, '#FFE08A');
      break;
    }
    case 'checking': {
      p(-1, 10, 3, 4, '#F3EDE2'); p(-1, 10, 3, 1, '#8B5A2B'); p(0, 12, 1, 1, '#5FAE78');
      break;
    }
    case 'typing':
      break;
  }
}

export function lookOf(a: AgentVisual): Look {
  return { skin: a.skin, hair: a.hair, hairStyle: a.hairStyle, shirt: a.shirt, apron: a.apron, accessory: a.accessory };
}
