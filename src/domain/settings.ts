export type Wallpaper = 'teal' | 'clouds' | 'night' | 'floppy';
export type MotionPref = 'system' | 'reduce' | 'full';
export type Settings = {
  sound: boolean;
  motion: MotionPref;
  textScale: 100 | 125 | 150;
  wallpaper: Wallpaper;
  highContrastFocus: boolean;
  skipBootAnimation: boolean;
};

export const defaultSettings = (): Settings => ({
  sound: false,
  motion: 'system',
  textScale: 100,
  wallpaper: 'teal',
  highContrastFocus: false,
  skipBootAnimation: false,
});

const WALLPAPERS: Wallpaper[] = ['teal', 'clouds', 'night', 'floppy'];

export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  return {
    sound: typeof r.sound === 'boolean' ? r.sound : d.sound,
    motion: r.motion === 'reduce' || r.motion === 'full' || r.motion === 'system' ? r.motion : d.motion,
    textScale: r.textScale === 125 || r.textScale === 150 || r.textScale === 100 ? r.textScale : d.textScale,
    wallpaper: WALLPAPERS.includes(r.wallpaper as Wallpaper) ? (r.wallpaper as Wallpaper) : d.wallpaper,
    highContrastFocus: typeof r.highContrastFocus === 'boolean' ? r.highContrastFocus : d.highContrastFocus,
    skipBootAnimation: typeof r.skipBootAnimation === 'boolean' ? r.skipBootAnimation : d.skipBootAnimation,
  };
}
