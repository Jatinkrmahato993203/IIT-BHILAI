export const APP_IDS = [
  'explorer',
  'notepad',
  'calculator',
  'browser',
  'terminal',
  'recycle',
  'vault',
  'imageviewer',
  'control',
  'help',
] as const;
export type AppId = (typeof APP_IDS)[number];
export const isAppId = (v: unknown): v is AppId => typeof v === 'string' && (APP_IDS as readonly string[]).includes(v);
