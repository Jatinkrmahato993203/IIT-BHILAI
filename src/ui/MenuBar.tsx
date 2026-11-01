import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export type MenuItem = { label: string; shortcut?: string; action?: () => void; disabled?: boolean; checked?: boolean; separator?: boolean };
export type Menu = { label: string; items: MenuItem[] };

/** Accessible application menu bar (WAI-ARIA menubar pattern). */
export function MenuBar({ menus, label }: { menus: Menu[]; label: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const tops = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (open === null) return;
    const close = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [open]);

  const focusItem = (menuIdx: number, which: 'first' | 'last') => {
    requestAnimationFrame(() => {
      const list = bar.current?.querySelector(`[data-menu="${menuIdx}"]`);
      const items = list ? [...list.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')] : [];
      (which === 'first' ? items[0] : items[items.length - 1])?.focus();
    });
  };

  const onTopKey = (e: KeyboardEvent, i: number) => {
    const n = menus.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
      tops.current[j]?.focus();
      if (open !== null) {
        setOpen(j);
        focusItem(j, 'first');
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(i);
      focusItem(i, 'first');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(i);
      focusItem(i, 'last');
    } else if (e.key === 'Escape' && open !== null) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(null);
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLUListElement>, i: number) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')];
    const k = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(k + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(k - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(null);
      tops.current[i]?.focus();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length;
      setOpen(j);
      tops.current[j]?.focus();
      focusItem(j, 'first');
    } else if (e.key === 'Tab') setOpen(null);
  };

  return (
    <div className="menubar" role="menubar" aria-label={label} ref={bar}>
      {menus.map((m, i) => (
        <div className="menubar-item" key={m.label}>
          <button
            ref={(el) => {
              tops.current[i] = el;
            }}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            tabIndex={i === 0 ? 0 : -1}
            className={open === i ? 'open' : undefined}
            onClick={() => setOpen(open === i ? null : i)}
            onPointerEnter={() => open !== null && setOpen(i)}
            onKeyDown={(e) => onTopKey(e, i)}
          >
            {m.label}
          </button>
          {open === i && (
            <ul className="menu-dropdown window" role="menu" aria-label={m.label} data-menu={i} onKeyDown={(e) => onMenuKey(e, i)}>
              {m.items.map((it, k) =>
                it.separator ? (
                  <li key={`sep${k}`} role="separator" className="menu-sep" />
                ) : (
                  <li
                    key={it.label}
                    role={it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
                    aria-checked={it.checked !== undefined ? it.checked : undefined}
                    aria-disabled={it.disabled ? 'true' : undefined}
                    tabIndex={-1}
                    onClick={() => {
                      if (it.disabled) return;
                      setOpen(null);
                      tops.current[i]?.focus();
                      it.action?.();
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !it.disabled) {
                        e.preventDefault();
                        setOpen(null);
                        tops.current[i]?.focus();
                        it.action?.();
                      }
                    }}
                  >
                    <span className="menu-check" aria-hidden="true">{it.checked ? '✓' : ''}</span>
                    <span className="menu-label">{it.label}</span>
                    {it.shortcut && <span className="menu-shortcut">{it.shortcut}</span>}
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
