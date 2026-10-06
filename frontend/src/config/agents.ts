// Konfigurasi visual agen. id harus sama dengan backend/agents/agents.json.
// Untuk menambah agen baru: tambahkan entri di sini + di backend (lihat README).

export type WorkAnim = 'typing' | 'stirring' | 'filming' | 'counting' | 'checking' | 'kneading';
export type Accessory = 'tie' | 'chefhat' | 'beret' | 'glasses' | 'bandana' | 'none';

export interface AgentVisual {
  id: string;
  name: string;
  role: string;
  home: string; // id ruangan (lihat game/map.ts)
  color: string; // warna utama (label, kanban)
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'bun' | 'bald' | 'curly';
  shirt: string;
  apron: string;
  accessory: Accessory;
  workAnims: WorkAnim[]; // animasi saat bekerja, bergantian
  /** Ruangan tambahan yang dikunjungi bergantian saat bekerja (mis. Operations ke gudang). */
  patrol?: string[];
  ambient: { pagi: string[]; siang: string[]; sore: string[]; malam: string[] };
}

export const AGENTS: AgentVisual[] = [
  {
    id: 'ceo',
    name: 'Raka',
    role: 'Owner CEO',
    home: 'owner',
    color: '#8B5A2B',
    skin: '#E8B48A',
    hair: '#2E1D10',
    hairStyle: 'short',
    shirt: '#F3EDE2',
    apron: '#6B4423',
    accessory: 'tie',
    workAnims: ['typing'],
    ambient: {
      pagi: ['Cek target omzet hari ini ☕', 'Briefing pagi jam 7 ya!'],
      siang: ['Antrean etalase rame nih 👀', 'Review laporan mingguan…'],
      sore: ['Siapa yang belum update kanban? 😄', 'Evaluasi penjualan siang'],
      malam: ['Rekap hari ini… lumayan!', 'Rencana besok: restock butter'],
    },
  },
  {
    id: 'marketing',
    name: 'Nadia',
    role: 'Marketing & Content',
    home: 'studio',
    color: '#E57F84',
    skin: '#F1C7A0',
    hair: '#6B3B2A',
    hairStyle: 'long',
    shirt: '#FFD2BC',
    apron: '#F59A78',
    accessory: 'beret',
    workAnims: ['filming', 'typing'],
    ambient: {
      pagi: ['Golden hour buat foto croissant ✨', 'Upload story pagi dulu'],
      siang: ['Reels kemarin tembus 12rb views!', 'Balas DM pelanggan…'],
      sore: ['Shooting flatlay kue kering 📸', 'Jadwal posting besok beres'],
      malam: ['Cek insight IG hari ini', 'Nulis caption buat besok'],
    },
  },
  {
    id: 'finance',
    name: 'Bima',
    role: 'Finance',
    home: 'kasir',
    color: '#5FAE78',
    skin: '#C98E64',
    hair: '#1F1A17',
    hairStyle: 'curly',
    shirt: '#C9EBD3',
    apron: '#3F7D57',
    accessory: 'glasses',
    workAnims: ['counting', 'typing'],
    ambient: {
      pagi: ['Buka kas: modal Rp500.000', 'Cek mutasi QRIS…'],
      siang: ['Transaksi ke-87 hari ini 🧾', 'Struk printer habis kertas!'],
      sore: ['Rekap omzet siang', 'Bandingkan HPP minggu lalu'],
      malam: ['Tutup kas & rekap harian 📊', 'Setor ke bank besok pagi'],
    },
  },
  {
    id: 'rnd',
    name: 'Sari',
    role: 'Recipe & R&D',
    home: 'testkitchen',
    color: '#D9A066',
    skin: '#EBC09A',
    hair: '#4A2F1A',
    hairStyle: 'bun',
    shirt: '#FFFFFF',
    apron: '#B8E0C2',
    accessory: 'bandana',
    workAnims: ['stirring', 'kneading'],
    ambient: {
      pagi: ['Uji resep sourdough hari ke-3 🍞', 'Timbang bahan… 250g pas'],
      siang: ['Coba varian matcha nastar?', 'Suhu oven 170°C, 18 menit'],
      sore: ['Catat hasil uji rasa', 'Adonan croissant di-laminating'],
      malam: ['Update kartu resep', 'Ide: cromboloni pandan 🤔'],
    },
  },
  {
    id: 'ops',
    name: 'Pak Joko',
    role: 'Operations',
    home: 'kitchen',
    color: '#C68642',
    skin: '#B9875E',
    hair: '#3B3B3B',
    hairStyle: 'bald',
    shirt: '#FFFFFF',
    apron: '#8B5A2B',
    accessory: 'chefhat',
    workAnims: ['kneading', 'checking'],
    patrol: ['gudang'],
    ambient: {
      pagi: ['Oven 1 & 2 sudah panas! 🔥', 'Batch roti tawar ke-3 masuk'],
      siang: ['Cek stok telur… sisa 8 tray', 'Packing pesanan online'],
      sore: ['Bersih-bersih dapur 🧽', 'Siapkan adonan besok pagi'],
      malam: ['Stock opname gudang 📦', 'Daftar belanja buat supplier'],
    },
  },
];

export const AGENT_BY_ID: Record<string, AgentVisual> = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

export function agentLabel(id?: string): string {
  if (!id) return '';
  if (id === 'owner') return 'Owner';
  if (id === 'sistem') return 'Sistem';
  return AGENT_BY_ID[id]?.role ?? id;
}

export function agentColor(id?: string): string {
  if (id === 'owner') return '#2E1D10';
  if (id === 'sistem') return '#9CA3AF';
  return (id && AGENT_BY_ID[id]?.color) || '#9CA3AF';
}

export const STATUS_LABEL: Record<string, string> = {
  idle: 'Santai',
  thinking: 'Berpikir',
  working: 'Bekerja',
  meeting: 'Rapat',
};
