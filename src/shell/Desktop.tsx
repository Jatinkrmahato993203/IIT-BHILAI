import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SEED_IDS } from '../content/seed';
import { useOs, useVfsVersion, useWindows } from '../os/OsContext';
import type { Overlay, Toast } from '../os/OsProvider';
import { Icon } from '../ui/icons';
import { Modal } from '../ui/Modal';
import { DESKTOP_ICONS, type DesktopIcon } from './desktopIcons';
import { Finale, BlueScreen } from './Finale';
import { RunDialog } from './RunDialog';
import { Taskbar } from './Taskbar';
import { WindowFrame } from './WindowFrame';

export function Desktop(props: {
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  toast: Toast;
  runOpen: boolean;
  setRunOpen: (b: boolean) => void;
  shutdownOpen: boolean;
  setShutdownOpen: (b: boolean) => void;
}) {
  const os = useOs();
  const { state, dispatch } = useWindows();
  useVfsVersion(os.vfs);
  const [selected, setSelected] = useState<string>(DESKTOP_ICONS[0].id);
  const [focusIdx, setFocusIdx] = useState(0);
  const [narrowDismissed, setNarrowDismissed] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [shutdownChoice, setShutdownChoice] = useState<'shutdown' | 'restart'>('shutdown');
  const iconRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const warned = useRef(false);
  const recycleFull = os.vfs.listDeleted().length > 0;

  useEffect(() => {
    iconRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (os.storageWarning && !warned.current) {
      warned.current = true;
      void os.message({ title: 'Disk not ready', icon: 'warning', text: [os.storageWarning, 'Tip: allow site data for this page to keep your progress.'] });
    }
  }, [os]);

  const activate = (ic: DesktopIcon) => {
    setSelected(ic.id);
    if (ic.nodeId) os.openNode(ic.nodeId);
    else if (ic.app) os.openApp(ic.app, ic.args);
  };

  const onIconKey = (e: KeyboardEvent, i: number) => {
    const n = DESKTOP_ICONS.length;
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % n;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(DESKTOP_ICONS[i]);
      return;
    } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setCtxMenu({ x: r.right, y: r.top });
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      setFocusIdx(next);
      setSelected(DESKTOP_ICONS[next].id);
      iconRefs.current[next]?.focus();
    }
  };

  const narrow = state.viewport.width <= 768;
  const wallpaper = os.settings.wallpaper;

  return (
    <div
      className="desktop"
      data-wallpaper={wallpaper}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('.os-window, .taskbar')) return;
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelected('');
        if (ctxMenu && !(e.target as HTMLElement).closest('.ctx-menu')) setCtxMenu(null);
      }}
    >
      <h1 className="visually-hidden">The Last Login — Windows 98-inspired desktop</h1>
      <nav className="desktop-icons" aria-label="Desktop icons" onPointerDown={(e) => e.target === e.currentTarget && setSelected('')}>
        {DESKTOP_ICONS.map((ic, i) => (
          <button
            key={ic.id}
            ref={(el) => {
              iconRefs.current[i] = el;
            }}
            className={`desktop-icon${selected === ic.id ? ' selected' : ''}`}
            tabIndex={focusIdx === i ? 0 : -1}
            aria-describedby="icon-help"
            onFocus={() => setFocusIdx(i)}
            onClick={() => setSelected(ic.id)}
            onDoubleClick={() => activate(ic)}
            onKeyDown={(e) => onIconKey(e, i)}
          >
            <Icon name={ic.id === 'recycle' ? (recycleFull ? 'recycleFull' : 'recycleEmpty') : ic.icon} size={32} />
            <span className="desktop-icon-label">{ic.label}</span>
          </button>
        ))}
        <span id="icon-help" className="visually-hidden">
          Press Enter to open. Arrow keys move between icons.
        </span>
      </nav>

      <div className="window-layer">
        {state.windows.map((w) => (
          <WindowFrame key={w.id} win={w} active={state.activeWindowId === w.id} />
        ))}
      </div>

      {narrow && !narrowDismissed && (
        <div className="narrow-notice window" role="note">
          <div className="window-body">
            <p>This computer is best enjoyed on a desktop screen (and in 1999). Everything still works here — windows fit the screen.</p>
            <button onClick={() => setNarrowDismissed(true)}>OK</button>
          </div>
        </div>
      )}

      {ctxMenu && (
        <ul className="ctx-menu window" role="menu" aria-label="Desktop menu" style={{ left: Math.min(ctxMenu.x, state.viewport.width - 200), top: Math.min(ctxMenu.y, state.viewport.height - 160) }}
          ref={(el) => el?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()}
          onKeyDown={(e) => {
            const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
            const i = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
            if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); setCtxMenu(null); iconRefs.current[focusIdx]?.focus(); }
          }}>
          {[
            { label: 'Arrange All Windows', fn: () => os.arrangeWindows() },
            { label: 'Minimize All Windows', fn: () => dispatch({ type: 'MINIMIZE_ALL' }) },
            { label: 'Open My Computer', fn: () => os.openApp('explorer', { folderId: SEED_IDS.root }) },
            { label: 'Properties', fn: () => os.openApp('control') },
          ].map((it) => (
            <li key={it.label} role="none">
              <button role="menuitem" tabIndex={-1} onClick={() => { setCtxMenu(null); it.fn(); }}>{it.label}</button>
            </li>
          ))}
        </ul>
      )}

      <Taskbar toast={props.toast} />

      {props.runOpen && <RunDialog onClose={() => props.setRunOpen(false)} />}

      {props.shutdownOpen && (
        <Modal
          title="Shut Down Windows"
          icon="shutdown"
          cancelValue="cancel"
          buttons={[
            { label: 'OK', value: 'ok', primary: true },
            { label: 'Cancel', value: 'cancel' },
          ]}
          onResult={(v) => {
            props.setShutdownOpen(false);
            if (v === 'ok') void os.shutdown(shutdownChoice);
          }}
        >
          <p>What do you want the computer to do?</p>
          <fieldset className="plain-fieldset">
            <legend className="visually-hidden">Shut down options</legend>
            <div className="field-row">
              <input id="sd-shutdown" type="radio" name="sd" checked={shutdownChoice === 'shutdown'} onChange={() => setShutdownChoice('shutdown')} />
              <label htmlFor="sd-shutdown">Shut down</label>
            </div>
            <div className="field-row">
              <input id="sd-restart" type="radio" name="sd" checked={shutdownChoice === 'restart'} onChange={() => setShutdownChoice('restart')} />
              <label htmlFor="sd-restart">Restart</label>
            </div>
          </fieldset>
          <p className="small">Your files and progress are kept.</p>
        </Modal>
      )}

      {props.overlay === 'bsod' && <BlueScreen onDismiss={() => props.setOverlay('finale')} />}
      {props.overlay === 'finale' && <Finale onClose={() => props.setOverlay(null)} />}
    </div>
  );
}
