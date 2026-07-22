import { describe, expect, it } from 'vitest';
import {
  getDailyThemeHue,
  getDailyThemeName,
  getDayOfYear,
  renderDailyThemeCss,
} from './daily-theme.js';

describe('daily-theme', () => {
  it('maps different dates to different hues', () => {
    const jan1 = new Date(2026, 0, 1);
    const jan2 = new Date(2026, 0, 2);
    expect(getDailyThemeHue(jan1)).not.toBe(getDailyThemeHue(jan2));
  });

  it('is stable for the same calendar day', () => {
    const morning = new Date(2026, 6, 22, 8, 0, 0);
    const evening = new Date(2026, 6, 22, 20, 0, 0);
    expect(getDailyThemeHue(morning)).toBe(getDailyThemeHue(evening));
    expect(getDayOfYear(morning)).toBe(getDayOfYear(evening));
  });

  it('renders css custom properties', () => {
    const css = renderDailyThemeCss(new Date(2026, 6, 22));
    expect(css).toContain(':root {');
    expect(css).toContain('--theme-primary:');
    expect(css).toContain('--theme-page-bg-end:');
    expect(css).toContain('--theme-page-bg-accent:');
  });

  it('returns localized theme names', () => {
    expect(getDailyThemeName('en', new Date(2026, 0, 1))).toMatch(/\S+/);
    expect(getDailyThemeName('zh', new Date(2026, 0, 1))).toMatch(/\S+/);
  });
});
