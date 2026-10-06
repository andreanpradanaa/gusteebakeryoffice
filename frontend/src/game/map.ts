// Tile map Gustee Bakery Office. Koordinat dalam satuan tile (1 tile = 16px dunia).
import type { WorkAnim } from '../config/agents';

export const TILE = 16;
export const COLS = 44;
export const ROWS = 32;

export type Face = 'up' | 'down' | 'left' | 'right';
export interface Spot { x: number; y: number; face: Face }

export type FloorKind = 'wood' | 'parquet' | 'checker' | 'carpet' | 'concrete' | 'shop' | 'hall' | 'tile';

export interface Room {
  id: string;
  name: string;
  x: number; y: number; w: number; h: number; // termasuk dinding
  floor: FloorKind;
  wall: string;
  spots: Partial<Record<WorkAnim | 'default', Spot>>;
  visit: Spot[];
}

export const ROOMS: Room[] = [
  { id: 'owner', name: 'Ruang Owner', x: 0, y: 0, w: 11, h: 9, floor: 'parquet', wall: '#C9A27E',
    spots: { default: { x: 5, y: 5, face: 'up' } }, visit: [{ x: 7, y: 6, face: 'left' }, { x: 3, y: 6, face: 'right' }] },
  { id: 'studio', name: 'Studio Konten', x: 10, y: 0, w: 12, h: 9, floor: 'carpet', wall: '#F2B8A8',
    spots: { default: { x: 19, y: 4, face: 'up' }, filming: { x: 14, y: 5, face: 'up' }, typing: { x: 19, y: 4, face: 'up' } },
    visit: [{ x: 17, y: 6, face: 'right' }, { x: 12, y: 6, face: 'right' }] },
  { id: 'meeting', name: 'Ruang Meeting', x: 21, y: 0, w: 14, h: 9, floor: 'wood', wall: '#B9D9C2',
    spots: { default: { x: 23, y: 4, face: 'right' } }, visit: [{ x: 27, y: 6, face: 'up' }] },
  { id: 'gudang', name: 'Gudang', x: 34, y: 0, w: 10, h: 20, floor: 'concrete', wall: '#A89F94',
    spots: { default: { x: 38, y: 5, face: 'up' }, checking: { x: 38, y: 5, face: 'up' } },
    visit: [{ x: 37, y: 10, face: 'right' }, { x: 40, y: 13, face: 'up' }] },
  { id: 'kasir', name: 'Kasir & Administrasi', x: 0, y: 11, w: 11, h: 9, floor: 'wood', wall: '#D8C3A5',
    spots: { default: { x: 3, y: 15, face: 'up' }, typing: { x: 3, y: 15, face: 'up' }, counting: { x: 8, y: 15, face: 'up' } },
    visit: [{ x: 6, y: 17, face: 'up' }, { x: 2, y: 17, face: 'up' }] },
  { id: 'testkitchen', name: 'Test Kitchen', x: 10, y: 11, w: 12, h: 9, floor: 'checker', wall: '#F6D7A7',
    spots: { default: { x: 15, y: 14, face: 'down' }, stirring: { x: 15, y: 14, face: 'down' }, kneading: { x: 13, y: 14, face: 'down' } },
    visit: [{ x: 18, y: 14, face: 'left' }, { x: 12, y: 17, face: 'right' }] },
  { id: 'kitchen', name: 'Dapur Produksi', x: 21, y: 11, w: 14, h: 9, floor: 'tile', wall: '#E9D8C4',
    spots: { default: { x: 26, y: 14, face: 'down' }, kneading: { x: 26, y: 14, face: 'down' }, checking: { x: 32, y: 13, face: 'up' } },
    visit: [{ x: 29, y: 14, face: 'left' }, { x: 23, y: 17, face: 'right' }] },
  { id: 'shop', name: 'Etalase Toko', x: 0, y: 22, w: 44, h: 8, floor: 'shop', wall: '#E8C9A0',
    spots: { default: { x: 15, y: 25, face: 'down' } }, visit: [{ x: 21, y: 26, face: 'down' }] },
];

export const ROOM_BY_ID: Record<string, Room> = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

// Lorong (bukan ruangan, tapi lantai yang bisa dilalui)
const HALLS = [
  { x: 1, y: 9, w: 33, h: 2 },
  { x: 1, y: 20, w: 42, h: 2 },
];

const DOORS: [number, number][] = [
  [5, 8], [6, 8], [15, 8], [16, 8], [27, 8], [28, 8],
  [34, 9], [34, 10], [34, 14], [34, 15], [38, 19], [39, 19],
  [5, 11], [6, 11], [5, 19], [6, 19],
  [15, 11], [16, 11], [15, 19], [16, 19],
  [27, 11], [28, 11], [27, 19], [28, 19],
  [4, 22], [5, 22], [6, 22], [7, 22], [19, 22], [20, 22], [21, 22], [22, 22], [23, 22], [24, 22],
  [37, 22], [38, 22], [39, 22], [40, 22],
  [20, 29], [21, 29], [22, 29], [23, 29],
];

export type FurnitureKind =
  | 'bookshelf' | 'desk' | 'monitorDesk' | 'plant' | 'rug' | 'cabinet' | 'sofa' | 'trophy'
  | 'phototable' | 'ringlight' | 'camera' | 'backdrop'
  | 'meetingtable' | 'chair' | 'kanban' | 'whiteboard'
  | 'shelf' | 'sacks' | 'boxes'
  | 'register' | 'filing' | 'safe'
  | 'oven' | 'spice' | 'island' | 'fridge' | 'mixer' | 'worktable' | 'rack' | 'sink'
  | 'display' | 'cafetable' | 'counter' | 'breadshelf' | 'menuboard';

export interface Furniture { kind: FurnitureKind; x: number; y: number; w: number; h: number; solid: boolean }

const F = (kind: FurnitureKind, x: number, y: number, w = 1, h = 1, solid = true): Furniture => ({ kind, x, y, w, h, solid });

export const FURNITURE: Furniture[] = [
  // Ruang owner
  F('rug', 2, 5, 7, 2, false), F('bookshelf', 1, 1, 3, 1), F('cabinet', 7, 1, 2, 1), F('plant', 9, 1),
  F('monitorDesk', 3, 3, 5, 2), F('sofa', 1, 6, 1, 2), F('trophy', 4, 1),
  // Studio konten
  F('backdrop', 11, 1, 5, 1), F('phototable', 12, 2, 3, 2), F('ringlight', 15, 3), F('camera', 14, 6),
  F('monitorDesk', 18, 2, 3, 2), F('plant', 20, 7), F('rug', 11, 5, 4, 3, false),
  // Ruang meeting
  F('kanban', 24, 1, 8, 1, true), F('meetingtable', 24, 3, 8, 2), F('whiteboard', 33, 2, 1, 3), F('plant', 22, 1), F('plant', 33, 7),
  // Gudang
  F('shelf', 36, 4, 6, 1), F('shelf', 36, 8, 6, 1), F('shelf', 36, 12, 6, 1), F('shelf', 36, 16, 3, 1),
  F('sacks', 41, 1, 2, 2), F('boxes', 41, 16, 2, 2), F('sacks', 35, 1, 1, 2),
  // Kasir & administrasi
  F('monitorDesk', 2, 13, 3, 2), F('register', 7, 13, 3, 2), F('filing', 1, 12, 1, 1), F('safe', 9, 18), F('plant', 1, 18),
  // Test kitchen
  F('oven', 11, 12, 2, 1), F('spice', 17, 12, 2, 1), F('fridge', 19, 12, 2, 2), F('island', 12, 15, 6, 2), F('sink', 18, 17, 2, 1),
  // Dapur produksi
  F('oven', 22, 12, 3, 1), F('oven', 29, 12, 3, 1), F('mixer', 25, 12, 1, 1), F('rack', 32, 12, 1, 1), F('worktable', 23, 15, 8, 2), F('sink', 31, 17, 2, 1), F('rack', 22, 17, 1, 2),
  // Etalase toko
  F('display', 2, 24, 9, 1), F('breadshelf', 1, 23, 1, 5), F('counter', 13, 23, 5, 1), F('menuboard', 13, 23, 0, 0, false),
  F('display', 28, 24, 13, 1), F('breadshelf', 42, 23, 1, 5), F('cafetable', 8, 27, 2, 1), F('cafetable', 32, 27, 2, 1), F('cafetable', 27, 27, 2, 1),
  F('plant', 18, 28), F('plant', 25, 28), F('plant', 1, 28), F('plant', 42, 28),
];

// Grid: 0 = luar, 1 = lantai, 2 = dinding
export const grid: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
export const solid: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
export const roomGrid: (string | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

(function build() {
  for (const r of ROOMS) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const border = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
        if (border) grid[y][x] = 2;
        else if (grid[y][x] !== 2) {
          grid[y][x] = 1;
          roomGrid[y][x] = r.id;
        }
      }
  }
  for (const h of HALLS) {
    for (let y = h.y - 0; y < h.y + h.h; y++)
      for (let x = h.x; x < h.x + h.w; x++) if (grid[y][x] !== 2) grid[y][x] = 1;
    for (let y = h.y; y < h.y + h.h; y++) {
      grid[y][h.x - 1] = 2;
      if (grid[y][h.x + h.w] === 0) grid[y][h.x + h.w] = 2;
    }
  }
  // dinding pembatas lorong 2 (sisi kanan) & sudut
  for (let y = 20; y <= 21; y++) grid[y][43] = 2;
  for (const [x, y] of DOORS) grid[y][x] = 3; // pintu
  for (const f of FURNITURE)
    if (f.solid) for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) solid[y][x] = true;
})();

export function isDoor(x: number, y: number) {
  return grid[y]?.[x] === 3;
}

export function walkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  if (y >= 29) return false; // jangan keluar toko
  const g = grid[y][x];
  return (g === 1 || g === 3) && !solid[y][x];
}

/** BFS 4-arah. Mengembalikan daftar tile (tanpa tile awal). */
export function findPath(sx: number, sy: number, tx: number, ty: number): [number, number][] {
  if (sx === tx && sy === ty) return [];
  if (!walkable(tx, ty)) return [];
  const key = (x: number, y: number) => y * COLS + x;
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const q: number[] = [key(sx, sy)];
  prev[key(sx, sy)] = key(sx, sy);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (q.length) {
    const k = q.shift()!;
    const x = k % COLS, y = (k / COLS) | 0;
    if (x === tx && y === ty) break;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(nx, ny)) continue;
      const nk = key(nx, ny);
      if (prev[nk] !== -1) continue;
      prev[nk] = k;
      q.push(nk);
    }
  }
  const end = key(tx, ty);
  if (prev[end] === -1) return [];
  const path: [number, number][] = [];
  let c = end;
  while (c !== key(sx, sy)) {
    path.push([c % COLS, (c / COLS) | 0]);
    c = prev[c];
  }
  return path.reverse();
}

/** Kursi rapat, urutan sesuai indeks agen. */
export const MEETING_SEATS: Spot[] = [
  { x: 23, y: 3, face: 'right' },
  { x: 25, y: 2, face: 'down' }, { x: 28, y: 2, face: 'down' }, { x: 30, y: 2, face: 'down' },
  { x: 25, y: 5, face: 'up' }, { x: 28, y: 5, face: 'up' }, { x: 30, y: 5, face: 'up' },
  { x: 32, y: 4, face: 'left' }, { x: 26, y: 6, face: 'up' },
];

/** Posisi lampu untuk efek malam. */
export const LAMPS: [number, number][] = [
  [5, 3], [16, 3], [28, 4], [39, 6], [39, 14], [5, 15], [15, 15], [27, 15], [8, 25], [22, 25], [35, 25], [16, 10], [30, 21],
];

export function roomCenter(id: string): [number, number] {
  const r = ROOM_BY_ID[id];
  return r ? [r.x + r.w / 2, r.y + r.h / 2] : [22, 16];
}

export function randomWalkable(roomId: string, rnd = Math.random): [number, number] | null {
  const r = ROOM_BY_ID[roomId];
  if (!r) return null;
  for (let i = 0; i < 40; i++) {
    const x = r.x + 1 + Math.floor(rnd() * (r.w - 2));
    const y = r.y + 1 + Math.floor(rnd() * (r.h - 2));
    if (walkable(x, y)) return [x, y];
  }
  return null;
}
