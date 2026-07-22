export function getDayOfYear(date = new Date()): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86_400_000);
}

/** Golden-angle hue spread so each calendar day gets a distinct palette. */
export function getDailyThemeHue(date = new Date()): number {
  return (getDayOfYear(date) * 137.508) % 360;
}

function hsl(h: number, s: number, l: number, a?: number): string {
  const hh = Math.round(h);
  const ss = Math.round(s);
  const ll = Math.round(l);
  if (a === undefined) return `hsl(${hh}, ${ss}%, ${ll}%)`;
  return `hsla(${hh}, ${ss}%, ${ll}%, ${a})`;
}

const HUE_NAMES_EN = [
  'Rose Dawn',
  'Coral Glow',
  'Amber Day',
  'Golden Hour',
  'Spring Leaf',
  'Fresh Mint',
  'Ocean Teal',
  'Sky Blue',
  'Azure Calm',
  'Indigo Night',
  'Violet Dream',
  'Plum Mist',
  'Berry Bloom',
  'Pink Horizon',
] as const;

const HUE_NAMES_ZH = [
  '玫瑰晨曦',
  '珊瑚微光',
  '琥珀暖阳',
  '金色午后',
  '春叶清新',
  '薄荷清晨',
  '海洋青绿',
  '天空之蓝',
  '天蓝宁静',
  '靛蓝夜色',
  '紫罗兰梦',
  '梅紫薄雾',
  '浆果花开',
  '粉色地平线',
] as const;

function hueNameIndex(hue: number): number {
  return Math.floor(hue / (360 / HUE_NAMES_EN.length)) % HUE_NAMES_EN.length;
}

export function getDailyThemeName(lang: 'en' | 'zh', date = new Date()): string {
  const idx = hueNameIndex(getDailyThemeHue(date));
  return lang === 'zh' ? HUE_NAMES_ZH[idx] : HUE_NAMES_EN[idx];
}

export function renderDailyThemeCss(date = new Date()): string {
  const h = getDailyThemeHue(date);
  const warm = (h + 32) % 360;
  const accent = (h + 18) % 360;

  const vars: Record<string, string> = {
    '--theme-page-bg': hsl(h, 42, 91),
    '--theme-page-bg-end': hsl((h + 24) % 360, 36, 94),
    '--theme-page-bg-accent': hsl(accent, 32, 88),
    '--theme-surface': hsl(h, 28, 98.5),
    '--theme-surface-subtle': hsl(h, 32, 96),
    '--theme-surface-muted': hsl(h, 26, 93),
    '--theme-text-primary': hsl(h, 18, 22),
    '--theme-text-heading': hsl(h, 28, 14),
    '--theme-text-secondary': hsl(h, 16, 28),
    '--theme-text-muted': hsl(h, 10, 46),
    '--theme-text-subtle': hsl(h, 12, 38),
    '--theme-text-label': hsl(h, 8, 35),
    '--theme-text-muted-alt': hsl(h, 6, 42),
    '--theme-border': hsl(h, 16, 88),
    '--theme-border-muted': hsl(h, 14, 82),
    '--theme-border-light': hsl(h, 10, 86),
    '--theme-primary': hsl(h, 62, 46),
    '--theme-primary-hover': hsl(h, 62, 38),
    '--theme-primary-dark': hsl(h, 65, 34),
    '--theme-primary-light': hsl(h, 70, 95),
    '--theme-primary-muted': hsl(h, 55, 58),
    '--theme-primary-ring': hsl(h, 62, 46, 0.18),
    '--theme-panel-border': hsl(h, 55, 88),
    '--theme-panel-bg': hsl(h, 60, 97),
    '--theme-panel-title': hsl(h, 55, 32),
    '--theme-stats-border': hsl(h, 50, 82),
    '--theme-stats-bg-from': hsl(h, 55, 97),
    '--theme-stats-bg-to': hsl((h + 12) % 360, 45, 97),
    '--theme-stats-title': hsl(h, 50, 24),
    '--theme-stats-text': hsl(h, 48, 32),
    '--theme-stats-value': hsl(h, 52, 28),
    '--theme-stats-accent': hsl(h, 55, 42),
    '--theme-heatmap-empty': hsl(h, 12, 88),
    '--theme-heatmap-1': hsl(h, 45, 90),
    '--theme-heatmap-2': hsl(h, 50, 84),
    '--theme-heatmap-3': hsl(h, 55, 74),
    '--theme-heatmap-4': hsl(h, 58, 64),
    '--theme-heatmap-5': hsl(h, 60, 54),
    '--theme-heatmap-6': hsl(h, 62, 46),
    '--theme-heatmap-7': hsl(h, 65, 36),
    '--theme-warm-border': hsl(warm, 55, 78),
    '--theme-warm-bg-from': hsl(warm, 70, 97),
    '--theme-warm-bg-to': hsl(warm, 65, 92),
    '--theme-warm-title': hsl(warm, 55, 32),
    '--theme-warm-subtitle': hsl(warm, 48, 38),
    '--theme-warm-quote': hsl(warm, 42, 30),
    '--theme-star-border': hsl(accent, 45, 82),
    '--theme-star-bg-1': hsl(warm, 60, 97),
    '--theme-star-bg-2': hsl(accent, 50, 96),
    '--theme-star-bg-3': hsl(h, 45, 96),
    '--theme-star-title': hsl(warm, 50, 28),
    '--theme-star-subtitle': hsl(warm, 45, 34),
    '--theme-star-detail': hsl(accent, 45, 32),
    '--theme-btn-secondary-bg': hsl(h, 20, 93),
    '--theme-btn-secondary-hover': hsl(h, 18, 88),
    '--theme-info-bg': hsl(h, 45, 90),
    '--theme-info-text': hsl(h, 45, 26),
    '--theme-nav-border': hsl(h, 12, 86),
    '--theme-nav-text': hsl(h, 8, 38),
    '--theme-status-progress': hsl(h, 45, 42),
    '--theme-status-finished-bg': hsl(h, 55, 85),
    '--theme-status-finished-text': hsl(h, 55, 28),
    '--theme-generating-border': hsl(h, 55, 74),
    '--theme-generating-shadow': hsl(h, 62, 46, 0.15),
    '--theme-batch-title': hsl(h, 45, 22),
    '--theme-tooltip-bg': hsl(h, 28, 12),
  };

  const lines = Object.entries(vars)
    .map(([key, value]) => `            ${key}: ${value};`)
    .join('\n');

  return `:root {\n${lines}\n        }`;
}
