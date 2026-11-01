/** Trusted, literal registry of fake web pages. Nothing outside it is ever fetched or embedded. */
export const ROUTES = ['home', 'search', 'mail', 'guestbook', 'y2k', 'aarav'] as const;
export type Route = (typeof ROUTES)[number];
export const HOME: Route = 'home';

export type Resolution = { kind: 'page'; route: Route; query: string } | { kind: 'error'; reason: 'not-found' | 'blocked' | 'offline'; input: string };

const ALIASES: Record<string, Route> = {
  'www.dialup99.example': 'home',
  'dialup99.example': 'home',
  'www.webseek99.example': 'search',
  'webseek99.example': 'search',
  'mail.dialup99.example': 'mail',
  'www.geopages.example/aarav': 'aarav',
  'geopages.example/aarav': 'aarav',
  'www.y2kwatch.example': 'y2k',
  'y2kwatch.example': 'y2k',
};

export function resolveAddress(raw: string): Resolution {
  const input = (typeof raw === 'string' ? raw : '').trim().slice(0, 300);
  if (input === '') return { kind: 'page', route: HOME, query: '' };
  // eslint-disable-next-line no-script-url
  if (/^(javascript|data|vbscript|file|blob|about|chrome|view-source):/i.test(input)) return { kind: 'error', reason: 'blocked', input };
  const retro = /^retro:\/\/([a-z0-9-]+)\/?(?:\?q=(.*))?$/i.exec(input);
  if (retro) {
    const key = retro[1].toLowerCase();
    if ((ROUTES as readonly string[]).includes(key)) return { kind: 'page', route: key as Route, query: decodeQuery(retro[2] ?? '') };
    return { kind: 'error', reason: 'not-found', input };
  }
  const host = input.replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
  if (ALIASES[host]) return { kind: 'page', route: ALIASES[host], query: '' };
  if (/^https?:\/\//i.test(input) || /^[\w-]+(\.[\w-]+)+/.test(input)) return { kind: 'error', reason: 'offline', input };
  // Anything else is treated as a search, like 1999 browsers did with keywords.
  return { kind: 'page', route: 'search', query: input.slice(0, 100) };
}

function decodeQuery(q: string): string {
  try {
    return decodeURIComponent(q.replace(/\+/g, ' ')).slice(0, 100);
  } catch {
    return q.slice(0, 100);
  }
}

export const addressOf = (route: Route, query = '') => `retro://${route}${query ? `?q=${encodeURIComponent(query)}` : ''}`;
