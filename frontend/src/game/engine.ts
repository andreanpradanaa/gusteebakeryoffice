// Simulasi karakter: menentukan tujuan tiap agen dari state backend, mencari jalur (BFS),
// berjalan antar ruangan, animasi kerja, NPC (pembeli & baker), dan bubble ambient.
import { AGENTS, type AgentVisual, type WorkAnim } from '../config/agents';
import type { AgentRuntime } from '../store/useOffice';
import type { Phase } from '../lib/time';
import { findPath, MEETING_SEATS, randomWalkable, ROOM_BY_ID, TILE, type Face, type Spot } from './map';
import { lookOf, type Look } from './sprites';

export interface Char {
  id: string;
  name: string;
  color: string;
  look: Look;
  npc: boolean;
  x: number; // dunia (px), titik kaki
  y: number;
  tile: [number, number];
  path: [number, number][];
  destKey: string;
  face: Face;
  walking: boolean;
  anim: WorkAnim | null;
  visible: boolean;
  // agen
  vis?: AgentVisual;
  animIdx: number;
  animSwitchAt: number;
  ambient: { text: string; until: number } | null;
  nextAmbientAt: number;
  // npc
  room?: string;
  wanderAt: number;
}

const SPEED = 5.5 * TILE; // px per detik

const spotPx = (s: { x: number; y: number }): [number, number] => [s.x * TILE + TILE / 2, s.y * TILE + TILE - 2];

function makeAgentChar(v: AgentVisual): Char {
  const s = ROOM_BY_ID[v.home]?.spots.default ?? { x: 22, y: 10, face: 'down' as Face };
  const [x, y] = spotPx(s);
  return {
    id: v.id, name: v.name, color: v.color, look: lookOf(v), npc: false, x, y, tile: [s.x, s.y], path: [],
    destKey: '', face: s.face, walking: false, anim: null, visible: true, vis: v, animIdx: 0,
    animSwitchAt: 0, ambient: null, nextAmbientAt: 6 + Math.random() * 14, wanderAt: 0,
  };
}

const NPC_LOOKS: Look[] = [
  { skin: '#F1C7A0', hair: '#1F1A17', hairStyle: 'long', shirt: '#7FB3D5', apron: '#7FB3D5', accessory: 'none', pants: '#34495E' },
  { skin: '#C98E64', hair: '#3B2A1D', hairStyle: 'short', shirt: '#F7DC6F', apron: '#F7DC6F', accessory: 'none', pants: '#5D6D7E' },
  { skin: '#E8B48A', hair: '#6B3B2A', hairStyle: 'bun', shirt: '#BB8FCE', apron: '#BB8FCE', accessory: 'none', pants: '#4A235A' },
  { skin: '#EBC09A', hair: '#2E1D10', hairStyle: 'short', shirt: '#FFFFFF', apron: '#E9D8C4', accessory: 'chefhat' },
  { skin: '#B9875E', hair: '#2E1D10', hairStyle: 'curly', shirt: '#FFFFFF', apron: '#E9D8C4', accessory: 'chefhat' },
  { skin: '#F1C7A0', hair: '#4A2F1A', hairStyle: 'long', shirt: '#FFFFFF', apron: '#FFB89A', accessory: 'none', pants: '#6B4423' },
];

function makeNpc(i: number, room: string, name: string): Char {
  const t = randomWalkable(room) ?? [20, 25];
  const [x, y] = spotPx({ x: t[0], y: t[1] });
  return {
    id: `npc${i}`, name, color: '#999', look: NPC_LOOKS[i % NPC_LOOKS.length], npc: true, x, y, tile: t, path: [],
    destKey: '', face: 'down', walking: false, anim: null, visible: true, animIdx: 0, animSwitchAt: 0,
    ambient: null, nextAmbientAt: 0, room, wanderAt: Math.random() * 4,
  };
}

export class Engine {
  chars: Char[] = AGENTS.map(makeAgentChar);
  npcs: Char[] = [
    makeNpc(0, 'shop', 'Pembeli'),
    makeNpc(1, 'shop', 'Pembeli'),
    makeNpc(2, 'shop', 'Pembeli'),
    makeNpc(3, 'kitchen', 'Baker'),
    makeNpc(4, 'kitchen', 'Baker'),
    makeNpc(5, 'shop', 'Kasir toko'),
  ];
  time = 0;

  byId(id: string) {
    return this.chars.find((c) => c.id === id);
  }

  /** Tentukan titik tujuan & animasi agen berdasar state backend. */
  private target(c: Char, s: AgentRuntime | undefined, idx: number, phase: Phase, busyOffice: boolean): { spot: Spot; anim: WorkAnim | null } {
    const v = c.vis!;
    const home = ROOM_BY_ID[v.home];
    const homeSpot = home?.spots.default ?? { x: 22, y: 10, face: 'down' as Face };
    if (!s) return { spot: homeSpot, anim: null };
    if (s.status === 'meeting' || s.room === 'meeting') {
      return { spot: MEETING_SEATS[idx % MEETING_SEATS.length], anim: null };
    }
    if (s.room && s.room !== v.home && ROOM_BY_ID[s.room]) {
      const r = ROOM_BY_ID[s.room];
      return { spot: r.visit[idx % r.visit.length] ?? r.spots.default!, anim: null };
    }
    // bekerja: animasi bergantian; pagi hari dapur & test kitchen tetap sibuk walau tak ada tugas
    const kitchenMorning = !busyOffice && phase === 'pagi' && (v.id === 'ops' || v.id === 'rnd');
    const nightRecap = !busyOffice && phase === 'malam';
    if (s.status === 'working' || s.status === 'thinking' || kitchenMorning || nightRecap) {
      const anims = nightRecap && !kitchenMorning ? (v.workAnims.includes('typing') ? ['typing' as WorkAnim] : v.workAnims) : v.workAnims;
      if (this.time > c.animSwitchAt) {
        c.animIdx = (c.animIdx + 1) % anims.length;
        c.animSwitchAt = this.time + 8 + Math.random() * 6;
      }
      const anim = anims[c.animIdx % anims.length];
      let spot = home?.spots[anim] ?? homeSpot;
      if (v.patrol && anim === 'checking') {
        const pr = ROOM_BY_ID[v.patrol[0]];
        spot = pr?.spots.checking ?? spot;
      }
      return { spot, anim: s.status === 'thinking' ? null : anim };
    }
    return { spot: homeSpot, anim: null };
  }

  update(dt: number, agents: Record<string, AgentRuntime>, phase: Phase, busyOffice: boolean) {
    this.time += dt;
    this.chars.forEach((c, idx) => {
      const s = agents[c.id];
      const { spot, anim } = this.target(c, s, idx, phase, busyOffice);
      const key = `${spot.x},${spot.y}`;
      if (key !== c.destKey) {
        c.destKey = key;
        c.path = findPath(c.tile[0], c.tile[1], spot.x, spot.y);
        if (!c.path.length && (c.tile[0] !== spot.x || c.tile[1] !== spot.y)) {
          // tidak ada jalur (seharusnya tak terjadi) → teleport
          [c.x, c.y] = spotPx(spot);
          c.tile = [spot.x, spot.y];
        }
      }
      this.move(c, dt, spot.face);
      c.anim = c.walking ? null : anim;

      // bubble ambient saat kantor santai
      if (!busyOffice && s?.status === 'idle' && c.vis && this.time > c.nextAmbientAt) {
        const lines = c.vis.ambient[phase];
        if (Math.random() < 0.55 && lines.length) c.ambient = { text: lines[Math.floor(Math.random() * lines.length)], until: this.time + 4.5 };
        c.nextAmbientAt = this.time + 14 + Math.random() * 18;
      }
      if (busyOffice) c.ambient = null;
      if (c.ambient && this.time > c.ambient.until) c.ambient = null;
    });

    // NPC: pembeli hanya saat toko buka (pagi–sore), baker ramai saat pagi–siang
    for (const n of this.npcs) {
      const isBaker = n.room === 'kitchen';
      const isClerk = n.id === 'npc5';
      n.visible = phase !== 'malam' && (!isBaker || phase === 'pagi' || phase === 'siang');
      if (!n.visible) continue;
      if (isClerk) {
        // penjaga toko berdiri di belakang konter
        if (!n.destKey) {
          n.destKey = 'clerk';
          n.path = findPath(n.tile[0], n.tile[1], 15, 24);
        }
        this.move(n, dt, 'down');
        continue;
      }
      if (this.time > n.wanderAt && !n.path.length) {
        const t = randomWalkable(n.room!);
        if (t) n.path = findPath(n.tile[0], n.tile[1], t[0], t[1]);
        n.wanderAt = this.time + (isBaker ? 3 : 4) + Math.random() * 6;
      }
      this.move(n, dt, isBaker ? 'up' : 'down');
      n.anim = !n.walking && isBaker ? 'kneading' : null;
    }
  }

  private move(c: Char, dt: number, arriveFace: Face) {
    if (!c.path.length) {
      c.walking = false;
      c.face = arriveFace;
      return;
    }
    const [nx, ny] = c.path[0];
    const [tx, ty] = spotPx({ x: nx, y: ny });
    const dx = tx - c.x, dy = ty - c.y;
    const dist = Math.hypot(dx, dy);
    const stepLen = SPEED * dt;
    c.walking = true;
    if (Math.abs(dx) > Math.abs(dy)) c.face = dx > 0 ? 'right' : 'left';
    else if (dy !== 0) c.face = dy > 0 ? 'down' : 'up';
    if (dist <= stepLen) {
      c.x = tx;
      c.y = ty;
      c.tile = [nx, ny];
      c.path.shift();
      if (!c.path.length) {
        c.walking = false;
        c.face = arriveFace;
      }
    } else {
      c.x += (dx / dist) * stepLen;
      c.y += (dy / dist) * stepLen;
    }
  }

  /** Karakter agen di posisi dunia (untuk klik). */
  hit(wx: number, wy: number): string | null {
    const sorted = [...this.chars].sort((a, b) => b.y - a.y);
    for (const c of sorted) if (wx >= c.x - 8 && wx <= c.x + 8 && wy >= c.y - 26 && wy <= c.y + 3) return c.id;
    return null;
  }
}
