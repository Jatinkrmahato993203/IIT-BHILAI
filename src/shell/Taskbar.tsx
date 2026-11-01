import { useEffect, useRef, useState } from 'react';
import { has } from '../domain/story/engine';
import { useOs, useWindows } from '../os/OsContext';
import type { Toast } from '../os/OsProvider';
import { Icon } from '../ui/icons';
import { APPS } from './appRegistry';
import { StartMenu } from './StartMenu';

export function Taskbar({ toast }: { toast: Toast }) {
  const os = useOs();
  const { state, dispatch } = useWindows();
  const [startOpen, setStartOpen] = useState(false);
  const startBtn = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [expiredToast, setExpiredToast] = useState<number | null>(null);
  const visibleToast = toast && toast.id !== expiredToast ? toast : null;
  const finished = has(os.story, 'file.opened:survival-plan');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setExpiredToast(toast.id), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!startOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setStartOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [startOpen]);

  // Ctrl+Esc opens the Start menu (the Windows key is usually captured by the host OS).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && e.ctrlKey) {
        e.preventDefault();
        setStartOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clockLabel = finished ? '12:00 AM' : '11:58 PM';
  const ordered = [...state.windows].sort((a, b) => (a.id < b.id ? -1 : 1));
  const byOpen = state.windows; // keep open order for the taskbar (stable)

  return (
    <div className="taskbar" role="toolbar" aria-label="Taskbar" aria-orientation="horizontal" data-count={ordered.length}>
      <div className="start-wrap" ref={wrap}>
        <button
          ref={startBtn}
          className={`start-button${startOpen ? ' active' : ''}`}
          aria-haspopup="menu"
          aria-expanded={startOpen}
          aria-controls={startOpen ? 'start-menu' : undefined}
          onClick={() => setStartOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              setStartOpen(true);
            }
          }}
        >
          <Icon name="computer" size={16} />
          <b>Start</b>
        </button>
        {startOpen && (
          <StartMenu
            onClose={(returnFocus) => {
              setStartOpen(false);
              if (returnFocus) startBtn.current?.focus();
            }}
          />
        )}
      </div>
      <div className="taskbar-divider" aria-hidden="true" />
      <div className="task-buttons">
        {byOpen.map((w) => {
          const isActive = state.activeWindowId === w.id && w.mode !== 'minimized';
          return (
            <button
              key={w.id}
              className={`task-button${isActive ? ' active' : ''}`}
              aria-pressed={isActive}
              aria-label={`${w.mode === 'minimized' ? 'Restore' : isActive ? 'Minimize' : 'Activate'} ${w.title}`}
              title={w.title}
              onClick={() => dispatch({ type: 'TASKBAR_CLICK', id: w.id })}
            >
              <Icon name={APPS[w.appId].icon} size={16} />
              <span className="task-button-label">{w.title}</span>
            </button>
          );
        })}
      </div>
      <div className="tray" role="group" aria-label="System tray">
        {os.storageWarning && (
          <button
            className="tray-icon"
            aria-label="Warning: progress is not being saved"
            title="Session-only mode: progress is not being saved"
            onClick={() => void os.message({ title: 'Storage', icon: 'warning', text: os.storageWarning! })}
          >
            <Icon name="warning" size={16} />
          </button>
        )}
        <button
          className="tray-icon"
          aria-label={os.settings.sound ? 'Sound on. Click to mute' : 'Sound off. Click to turn on'}
          aria-pressed={os.settings.sound}
          title={os.settings.sound ? 'Volume: on' : 'Volume: muted'}
          onClick={() => os.updateSettings({ sound: !os.settings.sound })}
        >
          <Icon name={os.settings.sound ? 'speaker' : 'speakerMuted'} size={16} />
        </button>
        <button
          className="tray-clock"
          aria-label={finished ? 'Clock: 12:00 AM, Saturday 1 January 2000' : 'Clock: 11:58 PM, Friday 31 December 1999 (stopped)'}
          title={finished ? 'Saturday, January 01, 2000' : 'Friday, December 31, 1999'}
          onClick={() =>
            void os.message({
              title: 'Date/Time Properties',
              icon: 'info',
              text: finished
                ? ['Saturday, 1 January 2000, 12:00 AM.', 'The year 2000 has arrived. Nothing exploded. The toaster is fine.']
                : ['Friday, 31 December 1999, 11:58 PM.', 'The CMOS battery died the moment the owner shut down. The clock cannot be changed.', 'Time is a construct.'],
            })
          }
        >
          {clockLabel}
        </button>
      </div>
      {visibleToast && (
        <div className="balloon" role="status" key={visibleToast.id}>
          <Icon name="info" size={16} /> {visibleToast.text}
        </div>
      )}
    </div>
  );
}
