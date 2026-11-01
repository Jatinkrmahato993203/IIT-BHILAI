import { memo, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { useOs, useWindows } from '../os/OsContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/icons';
import { APPS } from './appRegistry';
import type { WindowRecord } from './windowReducer';

type Mode = null | { kind: 'move' | 'size'; origin: WindowRecord['bounds'] };

const EMPTY: Record<string, string> = {};

/** Mounted together with the lazily-loaded app, so focus can move in once it actually exists. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

const AppHost = memo(function AppHost({ windowId, appId, args, active, onReady }: { windowId: string; appId: WindowRecord['appId']; args: Record<string, string> | undefined; active: boolean; onReady: () => void }) {
  const def = APPS[appId];
  const C = def.component;
  const { requestClose } = useOs();
  return (
    <ErrorBoundary
      fallback={(e) => (
        <div className="app-crash" role="alert">
          <Icon name="error" />
          <div>
            <p>
              <strong>{def.title}</strong> has performed an illegal operation and will be shut down.
            </p>
            <p className="app-crash-detail">{/chunk|module|import/i.test(e.message) ? 'The program file could not be loaded. Check your connection and try again.' : 'If the problem persists, contact the program vendor (a 14-year-old).'}</p>
            <button onClick={() => void requestClose(windowId)}>Close</button>
          </div>
        </div>
      )}
    >
      <Suspense fallback={<div className="app-loading" role="status">Loading {def.title}…</div>}>
        <C windowId={windowId} args={args ?? EMPTY} active={active} />
        <Ready onReady={onReady} />
      </Suspense>
    </ErrorBoundary>
  );
});

export const WindowFrame = memo(function WindowFrame({ win, active }: { win: WindowRecord; active: boolean }) {
  const { dispatch } = useWindows();
  const { requestClose } = useOs();
  const ref = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const drag = useRef<{ kind: 'move' | 'size'; dx: number; dy: number; pointerId: number; raf: number } | null>(null);
  const def = APPS[win.appId];
  const minimized = win.mode === 'minimized';
  const maximized = win.mode === 'maximized';
  const titleId = `${win.id}-title`;

  const activeRef = useRef(active);
  useLayoutEffect(() => {
    activeRef.current = active && !minimized;
  });
  /** Move keyboard focus into this window unless it already holds focus (or a desktop dialog does). */
  const focusInside = useCallback(() => {
    const el = ref.current;
    if (!el || !activeRef.current) return;
    const cur = document.activeElement;
    if (cur && cur !== el && el.contains(cur)) return;
    if (cur?.closest('.modal-desktop, .start-menu, .bsod')) return;
    const target = (lastFocus.current && lastFocus.current.isConnected && el.contains(lastFocus.current) ? lastFocus.current : null) ??
      el.querySelector<HTMLElement>('.os-window-body [data-autofocus="true"]') ??
      el.querySelector<HTMLElement>('.os-window-body textarea, .os-window-body input, .os-window-body [tabindex="0"], .os-window-body button');
    (target ?? el).focus({ preventScroll: true });
  }, []);
  const onReady = useCallback(() => requestAnimationFrame(() => focusInside()), [focusInside]);

  // When this window becomes active, move keyboard focus into it (if focus is elsewhere).
  useEffect(() => {
    if (!active || minimized) return;
    const t = requestAnimationFrame(() => focusInside());
    return () => cancelAnimationFrame(t);
  }, [active, minimized, focusInside]);

  const onFocusCapture = (e: React.FocusEvent) => {
    if (e.target !== ref.current) lastFocus.current = e.target as HTMLElement;
    if (!active) dispatch({ type: 'FOCUS', id: win.id });
  };

  // ----- pointer drag (move & resize) -----
  const startDrag = (kind: 'move' | 'size') => (e: RPointerEvent) => {
    if (e.button !== 0 || maximized) return;
    if ((e.target as HTMLElement).closest('button, .sysmenu')) return;
    e.preventDefault();
    dispatch({ type: 'FOCUS', id: win.id });
    const b = win.bounds;
    drag.current = {
      kind,
      dx: kind === 'move' ? e.clientX - b.x : e.clientX - b.width,
      dy: kind === 'move' ? e.clientY - b.y : e.clientY - b.height,
      pointerId: e.pointerId,
      raf: 0,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const x = e.clientX - d.dx;
    const y = e.clientY - d.dy;
    cancelAnimationFrame(d.raf);
    d.raf = requestAnimationFrame(() => {
      if (d.kind === 'move') dispatch({ type: 'MOVE', id: win.id, x, y });
      else dispatch({ type: 'RESIZE', id: win.id, width: x, height: y });
    });
  };
  const endDrag = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };
  useEffect(() => () => {
    if (drag.current) cancelAnimationFrame(drag.current.raf);
  }, []);

  // ----- keyboard move / size mode -----
  const beginMode = (kind: 'move' | 'size') => {
    setMenuOpen(false);
    if (maximized) return;
    setMode({ kind, origin: win.bounds });
    ref.current?.focus(); // synchronously, so the very next arrow key is captured
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (mode) {
      const step = e.shiftKey ? 1 : 10;
      const b = win.bounds;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (delta[e.key]) {
        e.preventDefault();
        e.stopPropagation();
        const [dx, dy] = delta[e.key];
        if (mode.kind === 'move') dispatch({ type: 'MOVE', id: win.id, x: b.x + dx, y: b.y + dy });
        else dispatch({ type: 'RESIZE', id: win.id, width: b.width + dx, height: b.height + dy });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setMode(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: 'MOVE', id: win.id, x: mode.origin.x, y: mode.origin.y });
        dispatch({ type: 'RESIZE', id: win.id, width: mode.origin.width, height: mode.origin.height });
        setMode(null);
      }
      return;
    }
    // Ctrl+F4 closes the window (Alt+F4 is reserved by most browsers/OSes).
    if (e.key === 'F4' && e.ctrlKey) {
      e.preventDefault();
      void requestClose(win.id);
    }
  };

  const sysMenuRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (menuOpen) sysMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-sysmenu="${win.id}"]`)) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [menuOpen, win.id]);

  const sysItems: { label: string; action: () => void; disabled?: boolean }[] = [
    { label: 'Restore', action: () => dispatch({ type: 'RESTORE', id: win.id }), disabled: !maximized },
    { label: 'Move', action: () => beginMode('move'), disabled: maximized },
    { label: 'Size', action: () => beginMode('size'), disabled: maximized || !win.resizable },
    { label: 'Minimize', action: () => dispatch({ type: 'MINIMIZE', id: win.id }) },
    { label: 'Maximize', action: () => dispatch({ type: 'MAXIMIZE', id: win.id }), disabled: maximized || !win.resizable },
    { label: 'Close    Ctrl+F4', action: () => void requestClose(win.id) },
  ];

  const b = win.bounds;
  return (
    <div
      ref={ref}
      className={`window os-window${active ? ' is-active' : ''}${maximized ? ' is-maximized' : ''}${mode ? ' is-moving' : ''}`}
      role="dialog"
      aria-labelledby={titleId}
      data-active={active ? 'true' : 'false'}
      data-window-id={win.id}
      data-app={win.appId}
      tabIndex={-1}
      hidden={minimized}
      style={{ left: b.x, top: b.y, width: b.width, height: b.height, zIndex: 10 + win.z }}
      onPointerDownCapture={() => {
        if (!active) dispatch({ type: 'FOCUS', id: win.id });
      }}
      onFocusCapture={onFocusCapture}
      onBlur={(e) => {
        // Leaving the window while in Move/Size mode accepts the current position.
        if (mode && !e.currentTarget.contains(e.relatedTarget as Node | null)) setMode(null);
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className={`title-bar${active ? '' : ' inactive'}`}
        onPointerDown={startDrag('move')}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest('button') && win.resizable) dispatch({ type: 'TOGGLE_MAXIMIZE', id: win.id });
        }}
      >
        <div className="title-bar-text">
          <span className="sysmenu-wrap" data-sysmenu={win.id}>
            <button
              className="sysmenu-button"
              aria-label={`Window menu for ${win.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMenuOpen(true);
                }
              }}
            >
              <Icon name={def.icon} size={16} />
            </button>
          </span>
          <span id={titleId} className="title-text">
            {win.title}
          </span>
        </div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={() => dispatch({ type: 'MINIMIZE', id: win.id })} />
          {win.resizable && (
            <button aria-label={maximized ? 'Restore' : 'Maximize'} onClick={() => dispatch({ type: 'TOGGLE_MAXIMIZE', id: win.id })} />
          )}
          <button aria-label="Close" onClick={() => void requestClose(win.id)} />
        </div>
      </div>
      {menuOpen && (
        <ul
          className="sysmenu" data-sysmenu={win.id}
          role="menu"
          aria-label="Window menu"
          ref={sysMenuRef}
          onKeyDown={(e) => {
            const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')];
            const i = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              items[(i + 1) % items.length]?.focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              items[(i - 1 + items.length) % items.length]?.focus();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
              ref.current?.querySelector<HTMLElement>('.sysmenu-button')?.focus();
            } else if (e.key === 'Tab') setMenuOpen(false);
          }}
        >
          {/* oxlint-disable-next-line react/refs -- refs are only read inside the click/key handlers */}
          {sysItems.map((it) => (
            <li
              key={it.label}
              role="menuitem"
              tabIndex={-1}
              aria-disabled={it.disabled ? 'true' : undefined}
              onClick={() => {
                if (it.disabled) return;
                setMenuOpen(false);
                it.action();
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !it.disabled) {
                  e.preventDefault();
                  setMenuOpen(false);
                  it.action();
                }
              }}
            >
              {it.label}
            </li>
          ))}
        </ul>
      )}
      {mode && (
        <div className="move-hint" role="status">
          {mode.kind === 'move' ? 'Move' : 'Size'}: arrow keys (Shift = 1px), Enter to accept, Esc to cancel
        </div>
      )}
      <div className="window-body os-window-body">
        <AppHost windowId={win.id} appId={win.appId} args={win.args} active={active} onReady={onReady} />
      </div>
      {win.resizable && !maximized && (
        <div
          className="resize-handle"
          aria-hidden="true"
          onPointerDown={startDrag('size')}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        />
      )}
    </div>
  );
});
