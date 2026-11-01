import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { SEED_IDS, SEED_LAUNCHERS } from '../content/seed';
import { extensionOf } from '../domain/fs/validation';
import { isImage, type NodeId } from '../domain/fs/types';
import { sanitizeSettings, type Settings } from '../domain/settings';
import { applyEvent, has, initialStory, progressOf, sanitizeStory, type StoryEvent, type StoryState } from '../domain/story/engine';
import { seedIfNeeded, type Boot } from '../persistence/bootstrap';
import type { AppId } from '../shell/appIds';
import { APPS } from '../shell/appRegistry';
import { initialWindowState, windowReducer } from '../shell/windowReducer';
import { Modal } from '../ui/Modal';
import { playSound as rawPlay, type SoundName } from '../ui/sound';
import { OsContext, WindowsContext, type CloseGuard, type MessageOptions, type OsApi } from './OsContext';

type Pending = { id: number; opts: MessageOptions; resolve: (v: string) => void };
export type Overlay = null | 'bsod' | 'finale';
export type Toast = { id: number; text: string } | null;

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

function usePrefersReducedMotion() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [v, setV] = useState(q?.matches ?? false);
  useEffect(() => {
    if (!q) return;
    const on = () => setV(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, [q]);
  return v;
}

export type ShellHooks = {
  onShutdown: (mode: 'shutdown' | 'restart') => void;
};

export function OsProvider({ boot, hooks, children, render }: { boot: Boot; hooks: ShellHooks; children?: ReactNode; render: (ui: { overlay: Overlay; setOverlay: (o: Overlay) => void; toast: Toast; runOpen: boolean; setRunOpen: (b: boolean) => void; shutdownOpen: boolean; setShutdownOpen: (b: boolean) => void }) => ReactNode }) {
  const { vfs, adapter } = boot;
  const [story, setStory] = useState<StoryState>(boot.story);
  const storyRef = useRef(story);
  const [settings, setSettings] = useState<Settings>(boot.settings);
  const settingsRef = useRef(settings);
  const [state, dispatch] = useReducer(windowReducer, undefined, () => initialWindowState(viewport()));
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [clipboard, setClipboard] = useState<{ nodeId: NodeId } | null>(null);
  const [recent, setRecent] = useState<NodeId[]>([]);
  const [runOpen, setRunOpen] = useState(false);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState(boot.storageWarning);
  const guards = useRef(new Map<string, CloseGuard>());
  const dirty = useRef(new Set<string>());
  const openers = useRef(new Map<string, HTMLElement>());
  const counter = useRef(0);
  const msgId = useRef(0);
  const prefersReduced = usePrefersReducedMotion();
  const reduceMotion = settings.motion === 'reduce' || (settings.motion === 'system' && prefersReduced);

  // Hidden folder visibility is derived from story progress.
  useEffect(() => {
    vfs.setRevealed(has(story, 'clue.secret-unlocked') ? [SEED_IDS.secret] : []);
  }, [story, vfs]);

  // Viewport tracking.
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => dispatch({ type: 'VIEWPORT_CHANGED', viewport: viewport() }));
    };
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Warn before leaving with unsaved Notepad edits.
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => {
      if (dirty.current.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, []);

  const message = useCallback((opts: MessageOptions) => {
    return new Promise<string>((resolve) => {
      setQueue((q) => [...q, { id: ++msgId.current, opts, resolve }]);
    });
  }, []);

  const storageFailed = useRef(false);
  const noteStorageFailure = useCallback(() => {
    if (storageFailed.current) return;
    storageFailed.current = true;
    setStorageWarning('Progress could not be saved to browser storage. Changes from now on may be lost on reload.');
  }, []);

  // Cross-tab sync: another tab's commits are re-read from storage.
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined' || adapter.kind !== 'indexeddb') return;
    const ch = new BroadcastChannel('last-login');
    channel.current = ch;
    ch.onmessage = (ev: MessageEvent) => {
      const d = ev.data as { type?: string; ids?: unknown };
      if (d?.type === 'fs' && Array.isArray(d.ids)) void vfs.refreshFromStorage(d.ids.filter((x): x is string => typeof x === 'string').slice(0, 500));
      if (d?.type === 'story' || d?.type === 'settings')
        void adapter.load().then((snap) => {
          if (d.type === 'story') {
            const s = sanitizeStory(snap.story);
            storyRef.current = s;
            setStory(s);
          } else {
            const s = sanitizeSettings(snap.settings);
            settingsRef.current = s;
            setSettings(s);
          }
        }).catch(() => undefined);
    };
    vfs.setCommitListener((ids) => ch.postMessage({ type: 'fs', ids }));
    return () => {
      vfs.setCommitListener(null);
      ch.close();
      channel.current = null;
    };
  }, [adapter, vfs]);

  const playSound = useCallback((s: SoundName) => rawPlay(s, settingsRef.current.sound), []);

  const persistStory = useCallback(
    async (s: StoryState) => {
      try {
        await adapter.saveRecord('story', s);
        channel.current?.postMessage({ type: 'story' });
      } catch {
        noteStorageFailure();
      }
    },
    [adapter, noteStorageFailure],
  );

  const openApp = useCallback((appId: AppId, args: Record<string, string> = {}): string | null => {
    const def = APPS[appId];
    if (!def) return null;
    const s = stateRef.current;
    let id: string;
    if (def.singleton) id = appId;
    else {
      if (appId === 'notepad' && args.fileId) {
        const existing = s.windows.find((w) => w.appId === 'notepad' && w.args?.fileId === args.fileId);
        if (existing) {
          dispatch({ type: 'FOCUS', id: existing.id });
          return existing.id;
        }
      }
      id = `${appId}:${++counter.current}`;
    }
    const existing = s.windows.find((w) => w.id === id);
    if (existing) {
      if (Object.keys(args).length) dispatch({ type: 'SET_ARGS', id, args });
      dispatch({ type: 'FOCUS', id });
      return id;
    }
    if (s.windows.length >= 24) {
      void message({ title: 'Out of memory', icon: 'warning', text: 'There is not enough memory to start another program. Close some windows and try again. (640K was not enough after all.)' });
      return null;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) openers.current.set(id, active);
    dispatch({
      type: 'OPEN',
      spec: { id, appId, title: def.title, width: def.width, height: def.height, minWidth: def.minWidth, minHeight: def.minHeight, resizable: def.resizable ?? true, args },
    });
    return id;
  }, [message]);

  const emit = useCallback(
    (e: StoryEvent) => {
      const t = applyEvent(storyRef.current, e);
      if (!t.changed) return;
      storyRef.current = t.state;
      setStory(t.state);
      void persistStory(t.state).then(() => {
        for (const eff of t.effects) {
          if (eff === 'clue-found') {
            setToast({ id: Date.now(), text: `New clue discovered (${progressOf(t.state)} of 5)` });
            rawPlay('ding', settingsRef.current.sound);
          }
          if (eff === 'reveal-secret') {
            rawPlay('ding', settingsRef.current.sound);
            void message({
              title: 'SYSADMIN-99',
              icon: 'lock',
              text: ['ACCESS GRANTED.', 'A hidden folder has appeared on drive C: — C:\\TOP_SECRET'],
              buttons: [
                { label: 'Open folder', value: 'open', primary: true },
                { label: 'OK', value: 'ok' },
              ],
              cancelValue: 'ok',
            }).then((v) => {
              if (v === 'open') openApp('explorer', { folderId: SEED_IDS.secret });
            });
          }
          if (eff === 'show-finale') {
            rawPlay('crash', settingsRef.current.sound);
            setOverlay('bsod');
          }
        }
      });
    },
    [message, openApp, persistStory],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const next = sanitizeSettings({ ...settingsRef.current, ...patch });
      settingsRef.current = next;
      setSettings(next);
      adapter.saveRecord('settings', next).then(() => channel.current?.postMessage({ type: 'settings' }), noteStorageFailure);
    },
    [adapter, noteStorageFailure],
  );

  const openNode = useCallback(
    (id: NodeId) => {
      const node = vfs.getNode(id);
      if (!node || !vfs.isAccessible(id)) {
        void message({ title: 'Error', icon: 'error', text: 'The item could not be found. It may have been moved or deleted.' });
        return;
      }
      if (node.kind !== 'file') {
        openApp('explorer', { folderId: id });
        return;
      }
      setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 8));
      const launcher = SEED_LAUNCHERS[id];
      if (launcher) {
        openApp(launcher);
        return;
      }
      if (node.mimeType === 'text/plain') {
        openApp('notepad', { fileId: id });
        return;
      }
      if (isImage(node.mimeType)) {
        openApp('imageviewer', { fileId: id });
        return;
      }
      void message({
        title: 'Open With',
        icon: 'question',
        text: [`Windows cannot open '${node.name}'.`, `There is no program associated with .${extensionOf(node.name) || '(no extension)'} files on this computer.`],
      });
    },
    [message, openApp, vfs],
  );

  const setTitle = useCallback((windowId: string, title: string) => dispatch({ type: 'SET_TITLE', id: windowId, title }), []);
  const registerCloseGuard = useCallback((windowId: string, guard: CloseGuard | null) => {
    if (guard) guards.current.set(windowId, guard);
    else guards.current.delete(windowId);
  }, []);
  const setDirty = useCallback((windowId: string, d: boolean) => {
    if (d) dirty.current.add(windowId);
    else dirty.current.delete(windowId);
  }, []);

  const requestClose = useCallback(async (windowId: string) => {
    const guard = guards.current.get(windowId);
    if (guard) {
      dispatch({ type: 'FOCUS', id: windowId });
      const okToClose = await guard();
      if (!okToClose) return false;
    }
    guards.current.delete(windowId);
    dirty.current.delete(windowId);
    const opener = openers.current.get(windowId);
    openers.current.delete(windowId);
    dispatch({ type: 'CLOSE_CONFIRMED', id: windowId });
    // Return focus to the opener if it still exists, otherwise to the next window or desktop.
    requestAnimationFrame(() => {
      if (opener && opener.isConnected && !opener.closest('[hidden]')) opener.focus();
      else {
        const next = document.querySelector<HTMLElement>('.os-window[data-active="true"]');
        (next ?? document.querySelector<HTMLElement>('.desktop-icon[tabindex="0"]'))?.focus();
      }
    });
    return true;
  }, []);

  const closeAll = useCallback(async () => {
    const ids = [...stateRef.current.windows].sort((a, b) => b.z - a.z).map((w) => w.id);
    for (const id of ids) if (!(await requestClose(id))) return false;
    return true;
  }, [requestClose]);

  const resetStory = useCallback(async () => {
    const s = initialStory();
    storyRef.current = s;
    setStory(s);
    setOverlay(null);
    await persistStory(s);
  }, [persistStory]);

  const resetFilesystem = useCallback(async () => {
    if (!(await closeAll())) return;
    try {
      await adapter.clear('filesystem');
      await seedIfNeeded(adapter);
      const snap = await adapter.load();
      vfs.hydrate(snap.nodes, snap.contents);
      setClipboard(null);
      setRecent([]);
    } catch {
      noteStorageFailure();
      void message({ title: 'Error', icon: 'error', text: 'The disk could not be reset.' });
    }
  }, [adapter, closeAll, message, noteStorageFailure, vfs]);

  const shutdown = useCallback(
    async (mode: 'shutdown' | 'restart') => {
      if (!(await closeAll())) return;
      hooks.onShutdown(mode);
    },
    [closeAll, hooks],
  );

  const arrangeWindows = useCallback(() => dispatch({ type: 'CASCADE_ALL' }), []);

  const api: OsApi = useMemo(
    () => ({
      vfs, story, emit, settings, updateSettings, storageKind: adapter.kind, storageWarning, reduceMotion,
      openApp, openNode, setTitle, requestClose, registerCloseGuard, setDirty, message, resetStory, resetFilesystem,
      clipboard, setClipboard, recent, playSound, shutdown, arrangeWindows,
      showRun: () => setRunOpen(true), showShutdown: () => setShutdownOpen(true),
    }),
    [vfs, story, emit, settings, updateSettings, adapter.kind, storageWarning, reduceMotion, openApp, openNode, setTitle, requestClose, registerCloseGuard, setDirty, message, resetStory, resetFilesystem, clipboard, recent, playSound, shutdown, arrangeWindows],
  );
  const windowsValue = useMemo(() => ({ state, dispatch }), [state]);

  const current = queue[0];
  return (
    <OsContext.Provider value={api}>
      <WindowsContext.Provider value={windowsValue}>
        {render({ overlay, setOverlay, toast, runOpen, setRunOpen, shutdownOpen, setShutdownOpen })}
        {children}
        {current && (
          <Modal
            key={current.id}
            title={current.opts.title}
            icon={current.opts.icon}
            buttons={current.opts.buttons}
            cancelValue={current.opts.cancelValue ?? (current.opts.buttons ? undefined : 'ok')}
            role={current.opts.icon === 'error' || current.opts.icon === 'warning' ? 'alertdialog' : 'dialog'}
            onResult={(v) => {
              current.resolve(v);
              setQueue((q) => q.filter((p) => p.id !== current.id));
            }}
          >
            {(Array.isArray(current.opts.text) ? current.opts.text : [current.opts.text]).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </Modal>
        )}
      </WindowsContext.Provider>
    </OsContext.Provider>
  );
}
