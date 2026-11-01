import { describe, expect, it } from 'vitest';
import { checkInvariants, initialWindowState, MAX_WINDOWS, windowReducer, type OpenSpec, type WindowAction, type WindowState } from '../shell/windowReducer';

const vp = { width: 1280, height: 720 };
const spec = (id: string, extra: Partial<OpenSpec> = {}): OpenSpec => ({ id, appId: 'notepad', title: id, width: 400, height: 300, ...extra });
const apply = (s: WindowState, ...actions: WindowAction[]) => actions.reduce(windowReducer, s);
const open3 = () => apply(initialWindowState(vp), { type: 'OPEN', spec: spec('a') }, { type: 'OPEN', spec: spec('b') }, { type: 'OPEN', spec: spec('c') });
const byId = (s: WindowState, id: string) => s.windows.find((w) => w.id === id)!;

describe('window reducer (TC-003)', () => {
  it('opening focuses the new window; exactly one active', () => {
    const s = open3();
    expect(s.activeWindowId).toBe('c');
    expect(checkInvariants(s)).toEqual([]);
    const f = apply(s, { type: 'FOCUS', id: 'a' });
    expect(f.activeWindowId).toBe('a');
    expect(byId(f, 'a').z).toBeGreaterThan(byId(f, 'c').z);
  });

  it('minimizing active window focuses the next topmost visible one', () => {
    let s = apply(open3(), { type: 'FOCUS', id: 'a' }, { type: 'MINIMIZE', id: 'a' });
    expect(s.activeWindowId).toBe('c');
    s = apply(s, { type: 'MINIMIZE', id: 'c' }, { type: 'MINIMIZE', id: 'b' });
    expect(s.activeWindowId).toBeNull();
    expect(checkInvariants(s)).toEqual([]);
  });

  it('maximize > minimize > restore > unmaximize returns original bounds', () => {
    let s = open3();
    const original = byId(s, 'b').bounds;
    s = apply(s, { type: 'MAXIMIZE', id: 'b' });
    expect(byId(s, 'b').mode).toBe('maximized');
    expect(byId(s, 'b').bounds).toEqual({ x: 0, y: 0, width: 1280, height: 690 });
    s = apply(s, { type: 'MINIMIZE', id: 'b' });
    s = apply(s, { type: 'TASKBAR_CLICK', id: 'b' });
    expect(byId(s, 'b').mode).toBe('maximized');
    s = apply(s, { type: 'RESTORE', id: 'b' });
    expect(byId(s, 'b').mode).toBe('normal');
    expect(byId(s, 'b').bounds).toEqual(original);
  });

  it('taskbar click toggles minimize for the active window and focuses inactive ones', () => {
    let s = open3();
    s = apply(s, { type: 'TASKBAR_CLICK', id: 'c' });
    expect(byId(s, 'c').mode).toBe('minimized');
    s = apply(s, { type: 'TASKBAR_CLICK', id: 'a' });
    expect(s.activeWindowId).toBe('a');
    s = apply(s, { type: 'TASKBAR_CLICK', id: 'c' });
    expect(s.activeWindowId).toBe('c');
    expect(byId(s, 'c').mode).toBe('normal');
  });

  it('clamps moves so the title bar stays reachable', () => {
    let s = apply(open3(), { type: 'MOVE', id: 'a', x: -5000, y: -5000 });
    expect(checkInvariants(s)).toEqual([]);
    s = apply(s, { type: 'MOVE', id: 'a', x: 99999, y: 99999 });
    expect(checkInvariants(s)).toEqual([]);
    expect(byId(s, 'a').bounds.y).toBeLessThanOrEqual(690 - 22);
  });

  it('viewport shrink keeps all windows recoverable (TC-020)', () => {
    let s = apply(open3(), { type: 'MOVE', id: 'a', x: 1100, y: 600 }, { type: 'MAXIMIZE', id: 'b' });
    s = apply(s, { type: 'VIEWPORT_CHANGED', viewport: { width: 390, height: 844 } });
    expect(checkInvariants(s)).toEqual([]);
    for (const w of s.windows) {
      expect(w.bounds.width).toBeLessThanOrEqual(390);
      expect(w.bounds.x).toBeGreaterThanOrEqual(0);
    }
    s = apply(s, { type: 'RESTORE', id: 'b' });
    expect(byId(s, 'b').bounds.width).toBeLessThanOrEqual(390);
  });

  it('close removes the record and picks the next active', () => {
    const s = apply(open3(), { type: 'CLOSE_CONFIRMED', id: 'c' });
    expect(s.windows.map((w) => w.id)).toEqual(['a', 'b']);
    expect(s.activeWindowId).toBe('b');
    expect(apply(s, { type: 'CLOSE_CONFIRMED', id: 'zzz' })).toBe(s);
  });

  it('re-opening an existing id focuses it (singletons)', () => {
    let s = apply(open3(), { type: 'MINIMIZE', id: 'a' });
    s = apply(s, { type: 'OPEN', spec: spec('a') });
    expect(s.windows.length).toBe(3);
    expect(s.activeWindowId).toBe('a');
    expect(byId(s, 'a').mode).toBe('normal');
  });

  it('caps the number of windows', () => {
    let s = initialWindowState(vp);
    for (let i = 0; i < MAX_WINDOWS + 5; i++) s = windowReducer(s, { type: 'OPEN', spec: spec('w' + i) });
    expect(s.windows.length).toBe(MAX_WINDOWS);
  });

  it('non-resizable windows ignore maximize/resize', () => {
    let s = apply(initialWindowState(vp), { type: 'OPEN', spec: spec('calc', { resizable: false }) });
    s = apply(s, { type: 'MAXIMIZE', id: 'calc' }, { type: 'RESIZE', id: 'calc', width: 900, height: 900 });
    expect(byId(s, 'calc').mode).toBe('normal');
    expect(byId(s, 'calc').bounds.width).toBe(400);
  });

  it('cascade rescues every window', () => {
    let s = apply(open3(), { type: 'MOVE', id: 'a', x: -3000, y: 0 }, { type: 'MINIMIZE', id: 'b' }, { type: 'CASCADE_ALL' });
    expect(s.windows.every((w) => w.mode === 'normal')).toBe(true);
    expect(checkInvariants(s)).toEqual([]);
    s = apply(s, { type: 'MINIMIZE_ALL' });
    expect(s.activeWindowId).toBeNull();
  });

  it('z-order compacts without changing order', () => {
    let s = apply(initialWindowState(vp), { type: 'OPEN', spec: spec('a') }, { type: 'OPEN', spec: spec('b') });
    for (let i = 0; i < 10_050; i++) s = windowReducer(s, { type: 'FOCUS', id: i % 2 ? 'a' : 'b' });
    expect(s.nextZ).toBeLessThan(10_001);
    expect(s.activeWindowId).toBe('a');
    expect(byId(s, 'a').z).toBeGreaterThan(byId(s, 'b').z);
  });
});
