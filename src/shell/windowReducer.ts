import type { AppId } from './appIds';

export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { width: number; height: number };
export type WindowMode = 'normal' | 'minimized' | 'maximized';

export type WindowRecord = {
  id: string;
  appId: AppId;
  title: string;
  bounds: Rect;
  /** Normal bounds remembered while maximized. */
  restoreBounds?: Rect;
  mode: WindowMode;
  /** Mode to return to when restored from minimized. */
  preMinimizeMode?: 'normal' | 'maximized';
  z: number;
  minSize: { width: number; height: number };
  resizable: boolean;
  /** App-specific launch arguments (trusted values only: node ids, routes). */
  args?: Record<string, string>;
};

export type WindowState = {
  windows: WindowRecord[];
  activeWindowId: string | null;
  nextZ: number;
  viewport: Viewport;
  openCount: number;
};

export const TASKBAR_HEIGHT = 30;
export const TITLEBAR_HEIGHT = 22;
/** Keep at least this many px of the title bar on screen horizontally. */
export const MIN_VISIBLE = 64;
export const MAX_WINDOWS = 24;
export const CASCADE_STEP = 28;
const CASCADE_ORIGIN = { x: 132, y: 24 };

export type OpenSpec = {
  id: string;
  appId: AppId;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  args?: Record<string, string>;
};

export type WindowAction =
  | { type: 'OPEN'; spec: OpenSpec }
  | { type: 'FOCUS'; id: string }
  | { type: 'MOVE'; id: string; x: number; y: number }
  | { type: 'RESIZE'; id: string; width: number; height: number }
  | { type: 'MINIMIZE'; id: string }
  | { type: 'MAXIMIZE'; id: string }
  | { type: 'RESTORE'; id: string }
  | { type: 'TOGGLE_MAXIMIZE'; id: string }
  | { type: 'TASKBAR_CLICK'; id: string }
  | { type: 'CLOSE_CONFIRMED'; id: string }
  | { type: 'SET_TITLE'; id: string; title: string }
  | { type: 'SET_ARGS'; id: string; args: Record<string, string> }
  | { type: 'VIEWPORT_CHANGED'; viewport: Viewport }
  | { type: 'CASCADE_ALL' }
  | { type: 'MINIMIZE_ALL' };

export const initialWindowState = (viewport: Viewport): WindowState => ({
  windows: [],
  activeWindowId: null,
  nextZ: 1,
  viewport,
  openCount: 0,
});

export const usableArea = (v: Viewport) => ({ width: Math.max(200, v.width), height: Math.max(150, v.height - TASKBAR_HEIGHT) });

/** Fit size into the viewport and keep the title bar reachable. */
export function clampRect(r: Rect, v: Viewport, min = { width: 120, height: 80 }): Rect {
  const area = usableArea(v);
  const width = Math.round(Math.min(Math.max(r.width, Math.min(min.width, area.width)), area.width));
  const height = Math.round(Math.min(Math.max(r.height, Math.min(min.height, area.height)), area.height));
  const minX = Math.min(0, MIN_VISIBLE - width);
  const maxX = area.width - MIN_VISIBLE;
  const x = Math.round(Math.min(Math.max(r.x, minX), Math.max(minX, maxX)));
  const y = Math.round(Math.min(Math.max(r.y, 0), Math.max(0, area.height - TITLEBAR_HEIGHT)));
  return { x, y, width, height };
}

/** On narrow screens windows are fully inside the viewport. */
function fitInside(r: Rect, v: Viewport, min: { width: number; height: number }): Rect {
  const c = clampRect(r, v, min);
  const area = usableArea(v);
  if (v.width <= 768) {
    c.x = Math.max(0, Math.min(c.x, area.width - c.width));
  }
  return c;
}

export const maximizedRect = (v: Viewport): Rect => ({ x: 0, y: 0, ...usableArea(v) });

function topmostVisible(windows: WindowRecord[], exceptId?: string): string | null {
  let best: WindowRecord | null = null;
  for (const w of windows) if (w.id !== exceptId && w.mode !== 'minimized' && (!best || w.z > best.z)) best = w;
  return best?.id ?? null;
}

const update = (s: WindowState, id: string, fn: (w: WindowRecord) => WindowRecord): WindowState => ({
  ...s,
  windows: s.windows.map((w) => (w.id === id ? fn(w) : w)),
});

/** Renumber z-order 1..n to avoid unbounded growth. */
function compact(s: WindowState): WindowState {
  if (s.nextZ < 10_000) return s;
  const order = [...s.windows].sort((a, b) => a.z - b.z).map((w) => w.id);
  return { ...s, windows: s.windows.map((w) => ({ ...w, z: order.indexOf(w.id) + 1 })), nextZ: order.length + 1 };
}

function focus(s: WindowState, id: string): WindowState {
  const w = s.windows.find((x) => x.id === id);
  if (!w) return s;
  let next = s;
  if (w.mode === 'minimized') next = restore(next, id);
  return compact({ ...update(next, id, (x) => ({ ...x, z: next.nextZ })), nextZ: next.nextZ + 1, activeWindowId: id });
}

function restore(s: WindowState, id: string): WindowState {
  const w = s.windows.find((x) => x.id === id);
  if (!w) return s;
  if (w.mode === 'minimized') {
    const mode = w.preMinimizeMode ?? 'normal';
    return update(s, id, (x) => ({ ...x, mode, preMinimizeMode: undefined, bounds: mode === 'maximized' ? maximizedRect(s.viewport) : x.bounds }));
  }
  if (w.mode === 'maximized') {
    const back = w.restoreBounds ?? w.bounds;
    return update(s, id, (x) => ({ ...x, mode: 'normal', bounds: fitInside(back, s.viewport, x.minSize), restoreBounds: undefined }));
  }
  return s;
}

export function windowReducer(s: WindowState, a: WindowAction): WindowState {
  switch (a.type) {
    case 'OPEN': {
      if (s.windows.some((w) => w.id === a.spec.id)) return focus(s, a.spec.id);
      if (s.windows.length >= MAX_WINDOWS) return s;
      // Cascade from a fixed origin (like Windows) so each new title bar sits below the
      // previous one and every window's title bar and controls stay visible and clickable.
      const area = usableArea(s.viewport);
      const step = (s.openCount % 8) * CASCADE_STEP;
      const width = Math.min(a.spec.width, area.width);
      const height = Math.min(a.spec.height, area.height);
      const baseX = Math.max(0, Math.min(CASCADE_ORIGIN.x, area.width - width - 7 * CASCADE_STEP));
      const baseY = Math.max(0, Math.min(CASCADE_ORIGIN.y, area.height - height - 7 * CASCADE_STEP));
      const min = { width: a.spec.minWidth ?? 160, height: a.spec.minHeight ?? 100 };
      const bounds = fitInside({ x: baseX + step, y: baseY + step, width, height }, s.viewport, min);
      const rec: WindowRecord = {
        id: a.spec.id,
        appId: a.spec.appId,
        title: a.spec.title,
        bounds,
        mode: 'normal',
        z: s.nextZ,
        minSize: min,
        resizable: a.spec.resizable ?? true,
        args: a.spec.args,
      };
      return compact({ ...s, windows: [...s.windows, rec], activeWindowId: rec.id, nextZ: s.nextZ + 1, openCount: s.openCount + 1 });
    }
    case 'FOCUS':
      if (s.activeWindowId === a.id && s.windows.find((w) => w.id === a.id)?.mode !== 'minimized') return s;
      return focus(s, a.id);
    case 'MOVE': {
      const w = s.windows.find((x) => x.id === a.id);
      if (!w || w.mode !== 'normal') return s;
      return update(s, a.id, (x) => ({ ...x, bounds: fitInside({ ...x.bounds, x: a.x, y: a.y }, s.viewport, x.minSize) }));
    }
    case 'RESIZE': {
      const w = s.windows.find((x) => x.id === a.id);
      if (!w || w.mode !== 'normal' || !w.resizable) return s;
      return update(s, a.id, (x) => ({ ...x, bounds: fitInside({ ...x.bounds, width: a.width, height: a.height }, s.viewport, x.minSize) }));
    }
    case 'MINIMIZE': {
      const w = s.windows.find((x) => x.id === a.id);
      if (!w || w.mode === 'minimized') return s;
      const next = update(s, a.id, (x) => ({ ...x, mode: 'minimized', preMinimizeMode: x.mode === 'maximized' ? 'maximized' : 'normal' }));
      return { ...next, activeWindowId: s.activeWindowId === a.id || s.activeWindowId === null ? topmostVisible(next.windows) : s.activeWindowId };
    }
    case 'MAXIMIZE': {
      const w = s.windows.find((x) => x.id === a.id);
      if (!w || !w.resizable) return s;
      if (w.mode === 'maximized') return focus(s, a.id);
      const normal = w.mode === 'minimized' ? w.bounds : w.bounds;
      const next = update(s, a.id, (x) => ({ ...x, mode: 'maximized', restoreBounds: x.restoreBounds ?? normal, bounds: maximizedRect(s.viewport), preMinimizeMode: undefined }));
      return focus(next, a.id);
    }
    case 'RESTORE':
      return focus(restore(s, a.id), a.id);
    case 'TOGGLE_MAXIMIZE': {
      const w = s.windows.find((x) => x.id === a.id);
      if (!w) return s;
      return windowReducer(s, { type: w.mode === 'maximized' ? 'RESTORE' : 'MAXIMIZE', id: a.id });
    }
    case 'TASKBAR_CLICK': {
      const w = s.windows.find((x) => x.id === a.id);
      if (!w) return s;
      if (w.mode === 'minimized') return focus(s, a.id);
      if (s.activeWindowId === a.id) return windowReducer(s, { type: 'MINIMIZE', id: a.id });
      return focus(s, a.id);
    }
    case 'CLOSE_CONFIRMED': {
      if (!s.windows.some((w) => w.id === a.id)) return s;
      const windows = s.windows.filter((w) => w.id !== a.id);
      return { ...s, windows, activeWindowId: s.activeWindowId === a.id ? topmostVisible(windows) : s.activeWindowId };
    }
    case 'SET_TITLE':
      return update(s, a.id, (x) => (x.title === a.title ? x : { ...x, title: a.title.slice(0, 200) }));
    case 'SET_ARGS':
      return update(s, a.id, (x) => ({ ...x, args: a.args }));
    case 'VIEWPORT_CHANGED': {
      const v = a.viewport;
      return {
        ...s,
        viewport: v,
        windows: s.windows.map((w) => ({
          ...w,
          bounds: w.mode === 'maximized' ? maximizedRect(v) : fitInside(w.bounds, v, w.minSize),
          restoreBounds: w.restoreBounds ? fitInside(w.restoreBounds, v, w.minSize) : undefined,
        })),
      };
    }
    case 'CASCADE_ALL': {
      // Rescue: bring every window back on screen in a tidy cascade.
      const area = usableArea(s.viewport);
      const ordered = [...s.windows].sort((x, y) => x.z - y.z);
      const windows = s.windows.map((w) => {
        const i = ordered.indexOf(w);
        const width = Math.min(w.mode === 'maximized' ? (w.restoreBounds?.width ?? 480) : w.bounds.width, area.width);
        const height = Math.min(w.mode === 'maximized' ? (w.restoreBounds?.height ?? 360) : w.bounds.height, area.height);
        const b = fitInside({ x: 16 + (i % 10) * 24, y: 16 + (i % 10) * 24, width, height }, s.viewport, w.minSize);
        return { ...w, mode: 'normal' as const, bounds: b, restoreBounds: undefined, preMinimizeMode: undefined };
      });
      const top = [...windows].sort((x, y) => y.z - x.z)[0];
      return { ...s, windows, activeWindowId: top?.id ?? null };
    }
    case 'MINIMIZE_ALL':
      return {
        ...s,
        windows: s.windows.map((w) => (w.mode === 'minimized' ? w : { ...w, mode: 'minimized', preMinimizeMode: w.mode === 'maximized' ? 'maximized' : 'normal' })),
        activeWindowId: null,
      };
  }
}

/** Invariant checks used by tests. */
export function checkInvariants(s: WindowState): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const w of s.windows) {
    if (ids.has(w.id)) errors.push(`duplicate id ${w.id}`);
    ids.add(w.id);
  }
  if (s.activeWindowId !== null) {
    const a = s.windows.find((w) => w.id === s.activeWindowId);
    if (!a) errors.push('active window missing');
    else if (a.mode === 'minimized') errors.push('active window minimized');
  }
  const area = usableArea(s.viewport);
  for (const w of s.windows) {
    if (w.mode === 'minimized') continue;
    const b = w.bounds;
    if (b.y < 0 || b.y > area.height - TITLEBAR_HEIGHT) errors.push(`${w.id} title bar off-screen vertically`);
    if (b.x + b.width < MIN_VISIBLE - 1 || b.x > area.width - MIN_VISIBLE + 1) errors.push(`${w.id} off-screen horizontally`);
  }
  return errors;
}
