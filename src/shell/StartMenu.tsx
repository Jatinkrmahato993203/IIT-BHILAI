import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SEED_IDS } from '../content/seed';
import { has } from '../domain/story/engine';
import { useOs } from '../os/OsContext';
import { Icon, type IconName } from '../ui/icons';

type Item = { id: string; label: string; icon: IconName; action?: () => void; children?: Item[]; separatorBefore?: boolean };

export function StartMenu({ onClose }: { onClose: (returnFocus: boolean) => void }) {
  const os = useOs();
  const [openSub, setOpenSub] = useState<string | null>(null);
  const rootRef = useRef<HTMLUListElement>(null);
  const run = (fn: () => void) => () => {
    onClose(false);
    fn();
  };

  const recentItems: Item[] = os.recent
    .map((id) => os.vfs.getNode(id))
    .filter((n): n is NonNullable<typeof n> => !!n && os.vfs.isAccessible(n.id))
    .slice(0, 6)
    .map((n) => ({ id: `recent-${n.id}`, label: n.name, icon: n.mimeType === 'image/svg' ? 'image' : 'document', action: run(() => os.openNode(n.id)) }));

  const items: Item[] = [
    {
      id: 'programs', label: 'Programs', icon: 'programs', children: [
        { id: 'p-explorer', label: 'Windows Explorer', icon: 'folderOpen', action: run(() => os.openApp('explorer', { folderId: SEED_IDS.root })) },
        { id: 'p-notepad', label: 'Notepad', icon: 'notepad', action: run(() => os.openApp('notepad')) },
        { id: 'p-calc', label: 'Calculator', icon: 'calculator', action: run(() => os.openApp('calculator')) },
        { id: 'p-dos', label: 'MS-DOS Prompt', icon: 'dos', action: run(() => os.openApp('terminal')) },
        { id: 'p-web', label: 'The Internet', icon: 'globe', action: run(() => os.openApp('browser')) },
        { id: 'p-vault', label: 'SYSADMIN-99 Vault', icon: 'vault', action: run(() => os.openApp('vault')) },
        { id: 'p-img', label: 'Imaging', icon: 'image', action: run(() => os.openApp('explorer', { folderId: SEED_IDS.pictures })) },
      ],
    },
    {
      id: 'documents', label: 'Documents', icon: 'documents', children: [
        { id: 'd-mydocs', label: 'My Documents', icon: 'folder', action: run(() => os.openApp('explorer', { folderId: SEED_IDS.docs })) },
        ...recentItems,
      ],
    },
    {
      id: 'settings', label: 'Settings', icon: 'control', children: [
        { id: 's-control', label: 'Control Panel', icon: 'control', action: run(() => os.openApp('control')) },
        { id: 's-arrange', label: 'Rescue: Arrange All Windows', icon: 'programs', action: run(() => os.arrangeWindows()) },
      ],
    },
    { id: 'help', label: 'Help', icon: 'help', action: run(() => os.openApp('help')) },
    { id: 'run', label: 'Run...', icon: 'run', action: run(() => os.showRun()) },
    { id: 'shutdown', label: 'Shut Down...', icon: 'shutdown', action: run(() => os.showShutdown()), separatorBefore: true },
  ];

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);

  const focusIn = (ul: HTMLElement | null, idx: number) => {
    const els = ul ? [...ul.querySelectorAll<HTMLElement>(':scope > li > [role="menuitem"]')] : [];
    if (els.length) els[(idx + els.length) % els.length].focus();
  };

  const onKey = (e: KeyboardEvent<HTMLUListElement>, isSub: boolean, parentId?: string) => {
    const ul = e.currentTarget;
    const els = [...ul.querySelectorAll<HTMLElement>(':scope > li > [role="menuitem"]')];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (i === -1 && !['Escape', 'Tab'].includes(e.key)) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        focusIn(ul, i + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        focusIn(ul, i - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusIn(ul, 0);
        break;
      case 'End':
        e.preventDefault();
        focusIn(ul, els.length - 1);
        break;
      case 'ArrowRight': {
        const id = els[i]?.dataset.sub;
        if (id) {
          e.preventDefault();
          e.stopPropagation();
          setOpenSub(id);
          requestAnimationFrame(() => focusIn(document.getElementById(`submenu-${id}`), 0));
        }
        break;
      }
      case 'ArrowLeft':
        if (isSub) {
          e.preventDefault();
          e.stopPropagation();
          setOpenSub(null);
          rootRef.current?.querySelector<HTMLElement>(`[data-sub="${parentId}"]`)?.focus();
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        if (isSub) {
          setOpenSub(null);
          rootRef.current?.querySelector<HTMLElement>(`[data-sub="${parentId}"]`)?.focus();
        } else onClose(true);
        break;
      case 'Tab':
        onClose(false);
        break;
    }
  };

  const renderList = (list: Item[], isSub: boolean, parentId?: string) => (
    <ul
      ref={isSub ? undefined : rootRef}
      id={isSub ? `submenu-${parentId}` : 'start-menu'}
      className={isSub ? 'start-submenu' : 'start-menu-list'}
      role="menu"
      aria-label={isSub ? (items.find((x) => x.id === parentId)?.label ?? 'Submenu') : 'Start menu'}
      onKeyDown={(e) => onKey(e, isSub, parentId)}
    >
      {list.map((it) => (
        <li key={it.id} role="none" className={it.separatorBefore ? 'sep-before' : undefined}
          onPointerEnter={() => !isSub && setOpenSub(it.children ? it.id : null)}>
          <button
            role="menuitem"
            tabIndex={-1}
            className="start-item"
            data-sub={it.children ? it.id : undefined}
            aria-haspopup={it.children ? 'menu' : undefined}
            aria-expanded={it.children ? openSub === it.id : undefined}
            onClick={() => {
              if (it.children) {
                // Hover already opens submenus; a click must never close it again.
                setOpenSub(it.id);
                requestAnimationFrame(() => focusIn(document.getElementById(`submenu-${it.id}`), 0));
              } else it.action?.();
            }}
          >
            <Icon name={it.icon} size={isSub ? 16 : 24} />
            <span className="start-item-label">{it.label}</span>
            {it.children && <span className="start-item-arrow" aria-hidden="true">▸</span>}
          </button>
          {it.children && openSub === it.id && renderList(it.children, true, it.id)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="start-menu window" data-finished={has(os.story, 'file.opened:survival-plan') ? 'true' : undefined}>
      <div className="start-banner" aria-hidden="true">
        <span>
          <b>The Last Login</b> 98
        </span>
      </div>
      {renderList(items, false)}
    </div>
  );
}
