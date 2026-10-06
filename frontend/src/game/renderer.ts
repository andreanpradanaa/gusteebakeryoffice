// Renderer canvas: lapisan statis (lantai, dinding, furnitur) di-cache, lalu tiap frame
// menggambar elemen animasi, karakter, pencahayaan siang/malam, label & bubble chat.
import type { KanbanCard } from '../lib/types';
import type { Phase } from '../lib/time';
import type { AgentRuntime } from '../store/useOffice';
import type { Char } from './engine';
import { drawCharacter } from './sprites';
import { COLS, FURNITURE, grid, LAMPS, ROOM_BY_ID, ROOMS, ROWS, roomGrid, TILE, type Furniture } from './map';

export interface Camera { scale: number; ox: number; oy: number }

const W = COLS * TILE;
const H = ROWS * TILE;

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export class Renderer {
  staticLayer: HTMLCanvasElement;
  private dark: HTMLCanvasElement;
  dpr = 1;
  private vw = 0;

  constructor() {
    this.staticLayer = document.createElement('canvas');
    this.staticLayer.width = W;
    this.staticLayer.height = H;
    this.dark = document.createElement('canvas');
    this.buildStatic();
    document.fonts?.ready.then(() => this.buildStatic());
  }

  // ---------------- Lapisan statis ----------------
  buildStatic() {
    const ctx = this.staticLayer.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    // jalanan & trotoar
    ctx.fillStyle = '#9BB58A';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const g = grid[y][x];
        if (g === 0) this.outside(ctx, x, y);
        else if (g === 1 || g === 3) this.floor(ctx, x, y);
      }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === 2) this.wall(ctx, x, y);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === 3) this.door(ctx, x, y);
    for (const f of FURNITURE) this.furniture(ctx, f);
    this.storefront(ctx);
  }

  private outside(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const px = x * TILE, py = y * TILE;
    if (y >= 30) {
      ctx.fillStyle = y === 30 ? '#D9CDBA' : '#BFB3A0';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(px, py + TILE - 1, TILE, 1);
      ctx.fillRect(px + TILE - 1, py, 1, TILE);
    } else {
      ctx.fillStyle = hash(x, y) > 0.5 ? '#A7C493' : '#9DBB89';
      ctx.fillRect(px, py, TILE, TILE);
    }
  }

  private floor(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const px = x * TILE, py = y * TILE;
    const room = roomGrid[y][x];
    const kind = room ? ROOM_BY_ID[room].floor : 'hall';
    const r = hash(x, y);
    switch (kind) {
      case 'parquet':
        ctx.fillStyle = (x + y) % 2 ? '#C89F70' : '#BC9163';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(80,50,20,0.18)';
        for (let i = 0; i < 4; i++) ctx.fillRect(px + ((x + y) % 2 ? i * 4 : 0), py + ((x + y) % 2 ? 0 : i * 4), (x + y) % 2 ? 1 : TILE, (x + y) % 2 ? TILE : 1);
        break;
      case 'wood':
        ctx.fillStyle = '#DDBB92';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(110,70,30,0.18)';
        ctx.fillRect(px, py + 7, TILE, 1);
        ctx.fillRect(px, py + 15, TILE, 1);
        ctx.fillRect(px + (y % 2 ? 4 : 11), py, 1, 7);
        ctx.fillRect(px + (y % 2 ? 12 : 3), py + 8, 1, 7);
        break;
      case 'carpet':
        ctx.fillStyle = '#F7D9CF';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(220,140,120,0.25)';
        if (r > 0.3) ctx.fillRect(px + Math.floor(r * 12), py + Math.floor(r * 7 + 4), 1, 1);
        ctx.fillRect(px + 8, py + 8, 1, 1);
        break;
      case 'checker':
        ctx.fillStyle = (x + y) % 2 ? '#FFF6E9' : '#F3D9B5';
        ctx.fillRect(px, py, TILE, TILE);
        break;
      case 'tile':
        ctx.fillStyle = '#EFE8DC';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#D9CFC0';
        ctx.fillRect(px, py, TILE, 1);
        ctx.fillRect(px, py, 1, TILE);
        ctx.fillRect(px + 8, py + 8, 1, 1);
        break;
      case 'concrete':
        ctx.fillStyle = '#C4BCAF';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(px + Math.floor(r * 14), py + Math.floor(hash(y, x) * 14), 2, 1);
        ctx.fillRect(px, py, TILE, 1);
        break;
      case 'shop':
        ctx.fillStyle = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? '#F6E3C6' : '#EBCFA6';
        ctx.fillRect(px, py, TILE, TILE);
        break;
      default: // lorong
        ctx.fillStyle = '#E9D6B8';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(140,100,60,0.12)';
        ctx.fillRect(px, py + 15, TILE, 1);
        if (x % 3 === 0) ctx.fillRect(px, py, 1, TILE);
    }
  }

  private wall(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const px = x * TILE, py = y * TILE;
    // warna dinding mengikuti ruangan terdekat
    let color = '#E0C9A6';
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const r = roomGrid[y + dy]?.[x + dx];
      if (r) { color = ROOM_BY_ID[r].wall; break; }
    }
    const below = grid[y + 1]?.[x];
    ctx.fillStyle = '#6B4A30';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = color;
    if (below === 1 || below === 3) {
      // dinding menghadap kita: atap gelap + muka dinding
      ctx.fillStyle = '#7A5A3F';
      ctx.fillRect(px, py, TILE, 5);
      ctx.fillStyle = color;
      ctx.fillRect(px, py + 5, TILE, 11);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(px, py + 14, TILE, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(px, py + 5, TILE, 1);
    } else {
      ctx.fillStyle = '#7A5A3F';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(px + 1, py + 1, TILE - 2, 1);
    }
  }

  private door(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const px = x * TILE, py = y * TILE;
    ctx.fillStyle = 'rgba(120,80,40,0.25)';
    const horizontalWall = grid[y][x - 1] === 2 || grid[y][x + 1] === 2 || grid[y][x - 1] === 3 || grid[y][x + 1] === 3;
    if (horizontalWall) {
      ctx.fillRect(px, py + 7, TILE, 2);
    } else {
      ctx.fillRect(px + 7, py, 2, TILE);
    }
  }

  private furniture(ctx: CanvasRenderingContext2D, f: Furniture) {
    const x = f.x * TILE, y = f.y * TILE, w = f.w * TILE, h = f.h * TILE;
    const R = (px: number, py: number, pw: number, ph: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + px, y + py, pw, ph);
    };
    const shadow = () => R(1, h - 1, w - 1, 2, 'rgba(40,25,10,0.18)');
    switch (f.kind) {
      case 'rug':
        R(0, 2, w, h - 4, '#E8A87C'); R(2, 4, w - 4, h - 8, '#F3C9A0'); R(4, 6, w - 8, 1, '#E8A87C');
        break;
      case 'bookshelf':
        shadow(); R(0, -6, w, h + 4, '#7A5230'); R(1, -5, w - 2, h + 2, '#5C3A1E');
        for (let i = 0; i < w - 3; i += 3) { R(2 + i, -4, 2, 6, ['#E57F84', '#5FAE78', '#D9A066', '#7FB3D5'][i % 4]); R(2 + i, 4, 2, 6, ['#F7DC6F', '#BB8FCE', '#E57F84'][i % 3]); }
        R(1, 2, w - 2, 1, '#7A5230');
        break;
      case 'cabinet': case 'filing':
        shadow(); R(0, -4, w, h + 2, '#A8794F'); R(1, -3, w - 2, h, '#BF8F62');
        R(w / 2 - 1, 2, 2, 1, '#5C3A1E'); R(1, 4, w - 2, 1, '#8B5A2B');
        break;
      case 'trophy':
        R(5, 2, 6, 6, '#F2C14E'); R(7, 8, 2, 3, '#D4A017'); R(5, 11, 6, 2, '#8B5A2B');
        break;
      case 'plant':
        R(4, 9, 8, 6, '#C0704A'); R(5, 10, 6, 1, '#D98B62');
        R(3, 2, 4, 7, '#5FAE78'); R(8, 1, 5, 8, '#4E9A66'); R(6, 0, 4, 6, '#6FC08A');
        break;
      case 'sofa':
        shadow(); R(0, 0, w, h, '#B86B4B'); R(3, 2, w - 3, h - 4, '#D98B62');
        break;
      case 'monitorDesk': case 'desk':
        shadow(); R(0, 2, w, h - 4, '#A8794F'); R(0, 2, w, 2, '#C49A6C'); R(1, h - 3, 2, 3, '#7A5230'); R(w - 3, h - 3, 2, 3, '#7A5230');
        if (f.kind === 'monitorDesk') {
          R(w / 2 - 7, -3, 14, 9, '#2B2B2B'); R(w / 2 - 6, -2, 12, 7, '#7FD3FF'); R(w / 2 - 1, 6, 2, 2, '#2B2B2B');
          R(w / 2 - 6, 9, 12, 3, '#DDD'); R(4, 6, 5, 5, '#FFFFFF'); R(5, 7, 3, 1, '#C68642'); R(w - 9, 7, 4, 4, '#F3EDE2'); R(w - 8, 8, 2, 2, '#6B4423');
        }
        break;
      case 'backdrop':
        R(0, -8, w, h + 4, '#FFE8DC');
        for (let i = 0; i < w; i += 8) R(i, -8, 4, h + 4, '#FFD2BC');
        break;
      case 'phototable':
        shadow(); R(0, 4, w, h - 6, '#FFFFFF'); R(0, 4, w, 2, '#F3EDE2');
        R(10, 4, 18, 10, '#F3C9A0'); R(10, 4, 18, 3, '#FFF6E9'); R(16, 0, 6, 4, '#E57F84'); // kue
        R(3, 16, 6, 4, '#D9A066'); R(36, 14, 7, 6, '#8B5A2B');
        break;
      case 'ringlight':
        R(7, 4, 2, 12, '#444'); R(2, -4, 12, 2, '#EEE'); R(2, 6, 12, 2, '#EEE'); R(2, -4, 2, 12, '#EEE'); R(12, -4, 2, 12, '#EEE');
        break;
      case 'camera':
        R(7, 6, 2, 9, '#444'); R(4, 14, 8, 1, '#444'); R(3, 1, 10, 6, '#222'); R(6, -1, 4, 2, '#222'); R(9, 3, 3, 3, '#7FD3FF');
        break;
      case 'meetingtable':
        R(1, h - 1, w - 1, 3, 'rgba(40,25,10,0.18)'); R(0, 0, w, h, '#8B5A2B'); R(2, 2, w - 4, h - 4, '#A8794F');
        for (let i = 12; i < w - 8; i += 32) { R(i, 8, 8, 6, '#FFFFFF'); R(i + 2, 10, 4, 2, '#C68642'); }
        R(w / 2 - 6, h / 2 - 4, 12, 8, '#F3EDE2'); R(w / 2 - 4, h / 2 - 2, 8, 4, '#D9A066');
        break;
      case 'kanban':
        // papan kanban dinding (isi catatan digambar dinamis)
        R(0, -14, w, 22, '#6B4A30'); R(2, -12, w - 4, 18, '#F7EBD3');
        for (let i = 1; i < 4; i++) R((w / 4) * i, -12, 1, 18, '#C9A27E');
        break;
      case 'whiteboard':
        R(4, 0, 10, h, '#9E9E9E'); R(5, 1, 8, h - 2, '#FFFFFF'); R(6, 6, 6, 1, '#E57F84'); R(6, 10, 5, 1, '#7FB3D5'); R(6, 14, 6, 1, '#5FAE78');
        break;
      case 'shelf':
        R(0, -10, w, h + 8, '#8C7A64'); R(0, -10, w, 2, '#A89580'); R(0, -2, w, 2, '#A89580'); R(0, 4, w, 2, '#6E5F4E');
        for (let i = 2; i < w - 6; i += 9) {
          const k = Math.floor(hash(f.x + i, f.y) * 4);
          const c = ['#F3EDE2', '#D9A066', '#C9A27E', '#F7DC6F'][k];
          R(i, -8, 7, 6, c); R(i + 1, -7, 5, 1, 'rgba(0,0,0,0.1)');
          R(i + 1, 0, 6, 4, ['#E8D5B5', '#FFFFFF', '#F2C14E'][k % 3]);
        }
        break;
      case 'sacks':
        R(1, 4, 13, 11, '#E8DCC2'); R(1, 4, 13, 2, '#D2C3A3'); R(4, 8, 7, 3, '#C68642');
        if (w > TILE) { R(17, 2, 13, 12, '#F3EDE2'); R(20, 6, 7, 3, '#5FAE78'); }
        if (h > TILE) { R(2, 18, 12, 12, '#E8DCC2'); R(5, 22, 6, 2, '#E57F84'); }
        break;
      case 'boxes':
        R(0, 4, 14, 12, '#C9A27E'); R(0, 9, 14, 1, '#A8794F'); R(16, 0, 14, 14, '#D9B48A'); R(22, 0, 2, 14, '#A8794F'); R(6, 18, 18, 12, '#C9A27E');
        break;
      case 'register':
        shadow(); R(0, 4, w, h - 6, '#A8794F'); R(0, 4, w, 3, '#C49A6C');
        R(14, -2, 14, 10, '#444'); R(16, 0, 10, 3, '#7FFFB2'); R(15, 4, 12, 3, '#666'); R(6, 10, 6, 6, '#F3EDE2'); R(32, 10, 8, 5, '#5FAE78');
        break;
      case 'safe':
        R(1, 2, 14, 13, '#5D6D7E'); R(3, 4, 10, 9, '#85929E'); R(7, 7, 3, 3, '#2C3E50');
        break;
      case 'oven':
        shadow(); R(0, -6, w, h + 4, '#8E8E8E'); R(1, -5, w - 2, 2, '#B5B5B5'); R(3, -1, w - 6, 9, '#3A3A3A');
        for (let i = 4; i < w - 4; i += 6) R(i, -4, 2, 1, '#E74C3C');
        break;
      case 'spice':
        R(0, -6, w, 4, '#A8794F');
        for (let i = 2; i < w - 2; i += 5) R(i, -12, 3, 6, ['#E74C3C', '#F1C40F', '#27AE60', '#8E44AD'][(i / 5) % 4 | 0]);
        R(0, 2, w, h - 2, '#C49A6C'); R(2, 6, w - 4, 4, '#F3EDE2');
        break;
      case 'fridge':
        R(0, -8, w, h + 6, '#DDE6EA'); R(1, -7, w - 2, h + 4, '#F4F8FA'); R(0, 6, w, 1, '#BFCAD0'); R(w - 5, -4, 2, 6, '#9AA7AE'); R(w - 5, 10, 2, 8, '#9AA7AE');
        break;
      case 'island': case 'worktable':
        R(1, h - 1, w - 1, 3, 'rgba(40,25,10,0.18)'); R(0, 0, w, h, '#B9A58A'); R(1, 1, w - 2, h - 4, '#E3D6C2'); R(0, h - 4, w, 4, '#9C8566');
        R(6, 6, 10, 8, '#F5DEB3'); R(7, 7, 8, 2, '#FBEBC9'); // adonan
        R(w - 26, 5, 12, 10, '#E9E2D0'); R(w - 24, 6, 8, 2, '#F3DFA9'); // mangkuk
        R(w / 2 - 2, 4, 10, 3, '#8B5A2B'); // rolling pin
        if (f.kind === 'worktable') for (let i = 34; i < w - 30; i += 12) { R(i, 8, 8, 6, '#D9A066'); R(i + 1, 8, 6, 2, '#E8B97C'); }
        break;
      case 'mixer':
        R(2, -6, 12, 18, '#E57F84'); R(4, -4, 8, 6, '#F49CA0'); R(4, 6, 8, 5, '#DDD');
        break;
      case 'rack':
        R(1, -6, w - 2, h + 4, '#9E9E9E');
        for (let i = -4; i < h - 2; i += 5) { R(2, i, w - 4, 1, '#777'); R(3, i - 3, w - 6, 3, '#D9A066'); }
        break;
      case 'sink':
        R(0, 2, w, h - 2, '#BFCAD0'); R(3, 4, w - 6, h - 7, '#8FA3AD'); R(w / 2 - 1, 0, 2, 4, '#777');
        break;
      case 'display':
        shadow(); R(0, -4, w, h + 2, '#8B5A2B'); R(1, -6, w - 2, 8, 'rgba(200,235,255,0.55)'); R(1, -6, w - 2, 1, '#FFFFFF');
        for (let i = 4; i < w - 8; i += 10) {
          const k = Math.floor(hash(f.x + i, 7) * 5);
          const c = ['#D9A066', '#C68642', '#E8B97C', '#F3C9A0', '#8B5A2B'][k];
          R(i, -3, 7, 4, c); R(i + 1, -3, 5, 1, 'rgba(255,255,255,0.35)');
        }
        R(0, 4, w, 4, '#6B4423');
        break;
      case 'breadshelf':
        R(0, 0, w, h, '#8B5A2B');
        for (let i = 3; i < h - 4; i += 7) { R(2, i, w - 4, 4, '#D9A066'); R(3, i, w - 6, 1, '#E8B97C'); }
        break;
      case 'counter':
        shadow(); R(0, 0, w, h, '#8B5A2B'); R(0, 0, w, 4, '#C49A6C'); R(w - 18, -6, 12, 8, '#444'); R(w - 16, -4, 8, 3, '#7FFFB2');
        R(6, -4, 10, 6, '#F3EDE2'); R(8, -3, 6, 3, '#E57F84');
        break;
      case 'menuboard':
        R(0, -19, 5 * TILE, 12, '#2E2E2E'); R(2, -17, 5 * TILE - 4, 8, '#3A3A3A');
        ctx.fillStyle = '#F7EBD3';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillText('MENU HARI INI', x + 6, y - 10);
        break;
      case 'cafetable':
        R(2, 2, w - 4, 10, '#A8794F'); R(4, 4, w - 8, 6, '#C49A6C'); R(w / 2 - 3, 4, 6, 4, '#FFFFFF');
        R(-4, 4, 4, 6, '#8B5A2B'); R(w, 4, 4, 6, '#8B5A2B');
        break;
      case 'chair':
        R(3, 3, 10, 10, '#8B5A2B');
        break;
    }
  }

  private storefront(ctx: CanvasRenderingContext2D) {
    // kanopi bergaris di depan toko
    const y = 29 * TILE;
    for (let x = 0; x < W; x += 8) {
      ctx.fillStyle = (x / 8) % 2 ? '#FFB89A' : '#FFF6E9';
      ctx.fillRect(x, y + 8, 8, 8);
    }
    ctx.fillStyle = '#C68642';
    ctx.fillRect(0, y + 15, W, 1);
    // pintu kaca
    ctx.fillStyle = 'rgba(200,235,255,0.7)';
    ctx.fillRect(20 * TILE, y, 4 * TILE, 8);
    ctx.fillStyle = '#6B4423';
    ctx.fillRect(22 * TILE - 1, y, 2, 8);
    // papan nama
    const sx = 13 * TILE, sy = 30 * TILE + 3, sw = 18 * TILE, sh = 24;
    ctx.fillStyle = '#4A2F1A';
    ctx.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#A8692F';
    ctx.fillRect(sx + 2, sy + 2, sw - 4, 2);
    ctx.fillStyle = '#FFF6E9';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GUSTEE BAKERY', sx + sw / 2, sy + 10);
    ctx.fillStyle = '#FFD2BC';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText('ROTI • PASTRY • KUE • HAMPERS', sx + sw / 2, sy + 19);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // pot bunga & bangku di trotoar
    for (const px of [4, 9, 34, 39]) {
      ctx.fillStyle = '#C0704A';
      ctx.fillRect(px * TILE + 3, 30 * TILE + 6, 10, 8);
      ctx.fillStyle = '#5FAE78';
      ctx.fillRect(px * TILE + 2, 30 * TILE, 12, 7);
      ctx.fillStyle = '#E57F84';
      ctx.fillRect(px * TILE + 5, 30 * TILE + 2, 2, 2);
      ctx.fillRect(px * TILE + 10, 30 * TILE + 3, 2, 2);
    }
  }

  // ---------------- Frame ----------------
  draw(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    vw: number,
    vh: number,
    t: number,
    chars: Char[],
    agents: Record<string, AgentRuntime>,
    cards: KanbanCard[],
    phase: Phase,
    dark: boolean,
    selected: string | null,
  ) {
    const dpr = this.dpr;
    this.vw = vw;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = dark ? '#15111B' : '#EADBC4';
    ctx.fillRect(0, 0, vw, vh);
    ctx.setTransform(cam.scale * dpr, 0, 0, cam.scale * dpr, cam.ox * dpr, cam.oy * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.staticLayer, 0, 0);

    this.dynamicProps(ctx, t, cards, phase);

    // karakter (urut y untuk kedalaman)
    const sorted = chars.filter((c) => c.visible).sort((a, b) => a.y - b.y);
    for (const c of sorted) {
      if (c.id === selected) {
        ctx.fillStyle = 'rgba(255,184,154,0.55)';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      drawCharacter(ctx, c.x, c.y, c.look, c.face, c.walking, t + (c.npc ? c.x * 0.01 : 0), c.anim);
    }

    this.lighting(ctx, cam, vw, vh, t, phase);

    // overlay layar (teks tajam pada zoom apa pun)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.roomLabels(ctx, cam, dark);
    for (const c of sorted) if (!c.npc) this.label(ctx, cam, c, agents[c.id], t);
    // bubble digambar terakhir, yang paling baru di atas
    const bubbles = sorted
      .filter((c) => !c.npc)
      .map((c) => ({ c, b: this.bubbleText(c, agents[c.id]) }))
      .filter((x) => x.b)
      .sort((a, b) => a.b!.at - b.b!.at);
    for (const { c, b } of bubbles) this.bubble(ctx, cam, c, b!.text, b!.live, b!.ambient, dark);
  }

  private dynamicProps(ctx: CanvasRenderingContext2D, t: number, cards: KanbanCard[], phase: Phase) {
    // nyala oven
    const flick = 0.5 + Math.sin(t * 7) * 0.15 + Math.sin(t * 13) * 0.1;
    for (const f of FURNITURE.filter((f) => f.kind === 'oven')) {
      ctx.fillStyle = `rgba(255,140,40,${flick})`;
      ctx.fillRect(f.x * TILE + 4, f.y * TILE, f.w * TILE - 8, 7);
      if (phase === 'pagi' || phase === 'siang') {
        // uap
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.6 + i / 3) % 1;
          ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
          ctx.fillRect(f.x * TILE + 6 + i * 10 + Math.sin(t * 2 + i) * 2, f.y * TILE - 8 - k * 14, 3, 3);
        }
      }
    }
    // layar monitor berkedip pelan
    for (const f of FURNITURE.filter((f) => f.kind === 'monitorDesk')) {
      const w = f.w * TILE;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.1 * Math.sin(t * 3 + f.x)})`;
      ctx.fillRect(f.x * TILE + w / 2 - 5, f.y * TILE - 1, 6 + Math.floor((t * 4) % 5), 1);
      ctx.fillRect(f.x * TILE + w / 2 - 5, f.y * TILE + 1, 4 + Math.floor((t * 3) % 6), 1);
    }
    // ring light
    const rl = FURNITURE.find((f) => f.kind === 'ringlight');
    if (rl) {
      ctx.fillStyle = `rgba(255,250,220,${0.35 + 0.15 * Math.sin(t * 4)})`;
      ctx.fillRect(rl.x * TILE + 4, rl.y * TILE - 2, 8, 8);
    }
    // papan kanban dinding: catatan tempel per kolom (dari tugas terbaru)
    const kb = FURNITURE.find((f) => f.kind === 'kanban');
    if (kb) {
      const latest = cards.length ? cards[cards.length - 1].taskId : null;
      const cols = ['todo', 'progress', 'review', 'done'] as const;
      const colW = (kb.w * TILE) / 4;
      cols.forEach((col, i) => {
        const items = cards.filter((c) => c.taskId === latest && c.column === col).slice(0, 6);
        items.forEach((c, j) => {
          const ax = AGENT_COLORS[c.agent] ?? '#F7DC6F';
          ctx.fillStyle = ax;
          ctx.fillRect(kb.x * TILE + i * colW + 3 + (j % 3) * 9, kb.y * TILE - 11 + Math.floor(j / 3) * 8, 7, 6);
        });
      });
    }
  }

  private lighting(ctx: CanvasRenderingContext2D, cam: Camera, vw: number, vh: number, t: number, phase: Phase) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (phase === 'pagi') {
      ctx.fillStyle = 'rgba(255,200,140,0.07)';
      ctx.fillRect(0, 0, vw, vh);
      return;
    }
    if (phase === 'siang') return;
    if (phase === 'sore') {
      ctx.fillStyle = 'rgba(255,140,60,0.13)';
      ctx.fillRect(0, 0, vw, vh);
      return;
    }
    // malam: lapisan gelap dengan "lubang" cahaya lampu
    const d = this.dark;
    if (d.width !== vw || d.height !== vh) {
      d.width = vw;
      d.height = vh;
    }
    const g = d.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, vw, vh);
    g.fillStyle = 'rgba(14,10,36,0.62)';
    g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'destination-out';
    for (const [lx, ly] of LAMPS) {
      const sx = (lx * TILE + 8) * cam.scale + cam.ox;
      const sy = (ly * TILE + 8) * cam.scale + cam.oy;
      const r = (70 + Math.sin(t * 2 + lx) * 2) * cam.scale;
      const grad = g.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, 'rgba(0,0,0,0.85)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.drawImage(d, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly] of LAMPS) {
      const sx = (lx * TILE + 8) * cam.scale + cam.ox;
      const sy = (ly * TILE + 8) * cam.scale + cam.oy;
      const r = 45 * cam.scale;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, 'rgba(255,170,80,0.16)');
      grad.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private roomLabels(ctx: CanvasRenderingContext2D, cam: Camera, dark: boolean) {
    const fs = Math.max(7, Math.min(10, 4.2 * cam.scale));
    ctx.font = `${fs}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    for (const r of ROOMS) {
      const sx = (r.x + 1) * TILE * cam.scale + cam.ox + 4;
      const sy = (r.y + 1) * TILE * cam.scale + cam.oy + (r.id === 'shop' ? 4 : 2);
      const label = r.name.toUpperCase();
      const w = ctx.measureText(label).width;
      ctx.fillStyle = dark ? 'rgba(30,24,38,0.75)' : 'rgba(255,246,233,0.82)';
      ctx.fillRect(sx - 3, sy - 3, w + 6, fs + 6);
      ctx.fillStyle = dark ? '#F3D9B5' : '#6B4423';
      ctx.fillText(label, sx, sy);
    }
    ctx.textBaseline = 'alphabetic';
  }

  private label(ctx: CanvasRenderingContext2D, cam: Camera, c: Char, s: AgentRuntime | undefined, t: number) {
    const sx = c.x * cam.scale + cam.ox;
    const sy = (c.y + 3) * cam.scale + cam.oy;
    ctx.font = '600 11px Inter, sans-serif';
    const text = c.name;
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = 'rgba(46,29,16,0.82)';
    roundRect(ctx, sx - w / 2, sy, w, 16, 8);
    ctx.fill();
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(sx - w / 2 + 7, sy + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF6E9';
    ctx.textAlign = 'left';
    ctx.fillText(text, sx - w / 2 + 12, sy + 12);

    // ikon status di atas kepala
    const hy = (c.y - 27) * cam.scale + cam.oy;
    const st = s?.status;
    if (st === 'thinking') {
      const dots = '•'.repeat(1 + (Math.floor(t * 3) % 3));
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRect(ctx, sx - 13, hy - 14, 26, 14, 7);
      ctx.fill();
      ctx.fillStyle = '#6B4423';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dots, sx, hy - 3);
      ctx.textAlign = 'left';
    } else if (st === 'working' && !c.walking) {
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(['🔨', '✍️', '⚙️'][Math.floor(t * 1.5) % 3], sx + 11 * cam.scale * 0.5, hy - 2);
      ctx.textAlign = 'left';
    } else if (st === 'meeting' && !c.walking) {
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💬', sx + 11 * cam.scale * 0.5, hy - 2);
      ctx.textAlign = 'left';
    }
  }

  private bubbleText(c: Char, s?: AgentRuntime): { text: string; live: boolean; ambient: boolean; at: number } | null {
    const b = s?.bubble;
    const now = Date.now();
    if (b && b.text.trim() && (!b.done || now - b.at < 6000)) {
      return { text: cleanForBubble(b.text), live: !b.done, ambient: false, at: b.at };
    }
    if (c.ambient) return { text: c.ambient.text, live: false, ambient: true, at: 0 };
    return null;
  }

  private bubble(ctx: CanvasRenderingContext2D, cam: Camera, c: Char, text: string, live: boolean, ambient: boolean, dark: boolean) {
    const sx = c.x * cam.scale + cam.ox;
    const sy = (c.y - 30) * cam.scale + cam.oy - 8;
    ctx.font = '12px Inter, sans-serif';
    const maxW = 210;
    const lines = wrap(ctx, text, maxW - 20, 4);
    const lw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const w = Math.min(maxW, lw + 20);
    const lh = 15;
    const h = lines.length * lh + 12;
    let bx = sx - w / 2;
    bx = Math.max(6, Math.min(bx, this.vw - w - 6));
    const by = sy - h;
    ctx.fillStyle = ambient ? (dark ? 'rgba(60,48,72,0.92)' : 'rgba(255,255,255,0.88)') : dark ? '#2A2233' : '#FFFFFF';
    ctx.strokeStyle = live ? c.color : dark ? '#5C4A6E' : '#E7CFA9';
    ctx.lineWidth = live ? 2 : 1.5;
    roundRect(ctx, bx, by, w, h, 9);
    ctx.fill();
    ctx.stroke();
    // ekor
    ctx.beginPath();
    ctx.moveTo(sx - 6, by + h - 1);
    ctx.lineTo(sx, by + h + 7);
    ctx.lineTo(sx + 6, by + h - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ambient ? (dark ? '#CDBFDB' : '#8B6B4E') : dark ? '#F3E7D6' : '#3A2716';
    ctx.font = ambient ? 'italic 12px Inter, sans-serif' : '12px Inter, sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, bx + 10, by + 18 + i * lh));
    if (live) {
      ctx.fillStyle = c.color;
      ctx.fillRect(bx + 10 + ctx.measureText(lines[lines.length - 1]).width + 2, by + 8 + (lines.length - 1) * lh, 2, 12);
    }
  }
}

const AGENT_COLORS: Record<string, string> = {
  ceo: '#C49A6C', marketing: '#F49CA0', finance: '#8CCB9E', rnd: '#F3C98B', ops: '#E0A96D',
};

function cleanForBubble(md: string): string {
  const s = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > 150 ? '…' + s.slice(-150) : s;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  // tampilkan baris terakhir (teks terbaru) bila terlalu panjang
  if (lines.length > maxLines) {
    const tail = lines.slice(-maxLines);
    tail[0] = '…' + tail[0];
    return tail;
  }
  return lines.length ? lines : [''];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
