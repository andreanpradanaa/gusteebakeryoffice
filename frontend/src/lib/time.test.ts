import { describe, expect, it } from 'vitest';
import { phaseOf, wibHour } from './time';

describe('phaseOf', () => {
  it.each([
    [5, 'pagi'],
    [10.99, 'pagi'],
    [11, 'siang'],
    [15, 'sore'],
    [18, 'malam'],
    [2, 'malam'],
  ])('jam %s → %s', (h, phase) => {
    expect(phaseOf(h)).toBe(phase);
  });
});

describe('wibHour', () => {
  it('mengonversi UTC ke WIB (UTC+7) dengan menit desimal', () => {
    expect(wibHour(new Date('2026-01-01T06:30:00Z'))).toBe(13.5);
  });

  it('melewati tengah malam', () => {
    expect(wibHour(new Date('2026-01-01T20:00:00Z'))).toBe(3);
  });
});
