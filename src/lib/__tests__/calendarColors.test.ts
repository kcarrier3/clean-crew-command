import { describe, it, expect } from 'vitest';
import { COLOR_SWATCHES } from '../calendarColors';

describe('Planning calendar color palette', () => {
  it('offers a wide variety of colors', () => {
    expect(COLOR_SWATCHES.length).toBeGreaterThanOrEqual(18);
  });
  it('keeps the original swatches so existing events still match', () => {
    const values = COLOR_SWATCHES.map((c) => c.value);
    for (const kept of ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#64748b']) {
      expect(values).toContain(kept);
    }
  });
  it('has unique labels and valid hex values (or empty for default)', () => {
    const labels = new Set(COLOR_SWATCHES.map((c) => c.label));
    expect(labels.size).toBe(COLOR_SWATCHES.length);
    for (const c of COLOR_SWATCHES) {
      expect(c.value === '' || /^#[0-9a-f]{6}$/i.test(c.value)).toBe(true);
    }
  });
});
