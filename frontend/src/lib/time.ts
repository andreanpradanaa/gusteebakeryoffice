export type Phase = 'pagi' | 'siang' | 'sore' | 'malam';

export const PHASE_LABEL: Record<Phase, string> = {
  pagi: 'Pagi 🌅',
  siang: 'Siang ☀️',
  sore: 'Sore 🌇',
  malam: 'Malam 🌙',
};

/** Jam desimal saat ini di zona WIB (UTC+7), mis. 13.5 = 13:30. */
export function wibHour(now = new Date()): number {
  return ((now.getUTCHours() + 7) % 24) + now.getUTCMinutes() / 60;
}

export function phaseOf(h: number): Phase {
  if (h >= 5 && h < 11) return 'pagi';
  if (h >= 11 && h < 15) return 'siang';
  if (h >= 15 && h < 18) return 'sore';
  return 'malam';
}

const fmtTime = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
const fmtDateTime = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export const formatTime = (ts: number) => fmtTime.format(new Date(ts));
export const formatDateTime = (ts: number) => fmtDateTime.format(new Date(ts));
