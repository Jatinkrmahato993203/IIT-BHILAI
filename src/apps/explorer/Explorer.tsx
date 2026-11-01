import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { SEED_IDS } from '../../content/seed';
import { ROOT_ID, type FsNode, type NodeId } from '../../domain/fs/types';
import { useOs, useVfsVersion } from '../../os/OsContext';
import type { AppProps } from '../../shell/appRegistry';
import { formatDate, formatSize, iconFor, typeLabel } from '../../ui/format';
import { Icon } from '../../ui/icons';
import { MenuBar } from '../../ui/MenuBar';

export default function Explorer({ windowId, args }: AppProps) {
  const os = useOs();
  const { vfs } = os;
  const version = useVfsVersion(vfs);
  const initial = args.folderId && vfs.getNode(args.folderId) ? args.folderId : ROOT_ID;
  const [folderId, setFolderId] = useState<NodeId>(initial);
  const [back, setBack] = useState<NodeId[]>([]);
  const [fwd, setFwd] = useState<NodeId[]>([]);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [renaming, setRenaming] = useState<NodeId | null>(null);
  const [renameText, setRenameText] = useState('');
  const [address, setAddress] = useState('');
  const [notice, setNotice] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const renameBusy = useRef(false);
  const renameCancelled = useRef(false);

  // A new folderId argument (e.g. from "Open folder") navigates this singleton-like instance.
  const lastArg = useRef(args.folderId);
  useEffect(() => {
    if (args.folderId && args.folderId !== lastArg.current) {
      lastArg.current = args.folderId;
      navigate(args.folderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.folderId]);

  // If the current folder disappears (deleted, hidden again after replay, reset), climb to a valid ancestor.
  useEffect(() => {
    if (vfs.isAccessible(folderId)) return;
    let cur = vfs.getNode(folderId);
    let target: NodeId = ROOT_ID;
    let guard = 0;
    while (cur?.parentId && guard++ < 64) {
      if (vfs.isAccessible(cur.parentId)) {
        target = cur.parentId;
        break;
      }
      cur = vfs.getNode(cur.parentId);
    }
    setFolderId(target);
    setBack([]);
    setFwd([]);
    setNotice('The folder you were viewing is no longer available.');
  }, [version, folderId, vfs]);

  const folder = vfs.getNode(folderId);
  const children = useMemo(() => vfs.listChildren(folderId), [vfs, folderId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const path = vfs.getDisplayPath(folderId);
  const title = folderId === ROOT_ID ? 'My Computer (C:)' : folder?.name ?? 'Explorer';

  useEffect(() => {
    os.setTitle(windowId, title);
    setAddress(path);
  }, [os, windowId, title, path]);

  useEffect(() => {
    if (selected && !children.some((c) => c.id === selected)) setSelected(children[0]?.id ?? null);
  }, [children, selected]);

  function navigate(id: NodeId, push = true) {
    const n = vfs.getNode(id);
    if (!n || !vfs.isAccessible(id)) {
      void os.message({ title: 'Error', icon: 'error', text: 'That folder could not be found.' });
      return;
    }
    if (n.kind === 'file') {
      os.openNode(id);
      return;
    }
    if (id === folderId) return;
    if (push) {
      setBack((b) => [...b, folderId].slice(-50));
      setFwd([]);
    }
    setNotice('');
    setFolderId(id);
    setSelected(null);
    setRenaming(null);
    requestAnimationFrame(() => listRef.current?.focus());
  }

  const goBack = () => {
    const prev = back[back.length - 1];
    if (!prev) return;
    setBack((b) => b.slice(0, -1));
    setFwd((f) => [folderId, ...f]);
    navigate(prev, false);
  };
  const goFwd = () => {
    const next = fwd[0];
    if (!next) return;
    setFwd((f) => f.slice(1));
    setBack((b) => [...b, folderId]);
    navigate(next, false);
  };
  const goUp = () => {
    if (folder?.parentId) navigate(folder.parentId);
  };

  const sel = selected ? vfs.getNode(selected) : undefined;

  const report = (r: { ok: boolean; error?: { message: string } }) => {
    if (!r.ok && r.error) void os.message({ title: 'Error', icon: 'error', text: r.error.message });
    return r.ok;
  };

  const openSelected = () => sel && (sel.kind === 'file' ? os.openNode(sel.id) : navigate(sel.id));

  const newItem = async (kind: 'folder' | 'text') => {
    const base = kind === 'folder' ? 'New Folder' : 'New Text Document.txt';
    const name = vfs.uniqueName(folderId, base);
    const r = kind === 'folder' ? await vfs.createFolder(folderId, name) : await vfs.createText(folderId, name, '');
    if (!report(r) || !r.ok) return;
    setSelected(r.value.id);
    renameCancelled.current = false;
    setRenaming(r.value.id);
    setRenameText(r.value.name);
  };

  const startRename = () => {
    if (!sel) return;
    if (sel.readOnly || sel.system) {
      void os.message({ title: 'Error Renaming File', icon: 'error', text: `Cannot rename ${sel.name}: it is read-only or a system item.` });
      return;
    }
    renameCancelled.current = false;
    setRenaming(sel.id);
    setRenameText(sel.name);
  };

  const commitRename = async () => {
    const id = renaming;
    if (!id || renameBusy.current || renameCancelled.current) return;
    renameBusy.current = true;
    try {
      const r = await vfs.rename(id, renameText);
      if (r.ok) {
        setRenaming(null);
        requestAnimationFrame(() => listRef.current?.focus());
      } else {
        await os.message({ title: 'Error Renaming File', icon: 'error', text: r.error.message });
      }
    } finally {
      renameBusy.current = false;
    }
  };

  const deleteSelected = async () => {
    if (!sel) return;
    const v = await os.message({
      title: 'Confirm File Delete',
      icon: 'question',
      text: `Are you sure you want to send '${sel.name}' to the Recycle Bin?`,
      buttons: [
        { label: 'Yes', value: 'yes', primary: true },
        { label: 'No', value: 'no' },
      ],
      cancelValue: 'no',
    });
    if (v !== 'yes') return;
    report(await vfs.softDelete(sel.id));
    listRef.current?.focus();
  };

  const cut = () => {
    if (!sel) return;
    if (sel.readOnly || sel.system) {
      void os.message({ title: 'Error', icon: 'error', text: `'${sel.name}' is protected and cannot be moved.` });
      return;
    }
    os.setClipboard({ nodeId: sel.id });
    setNotice(`'${sel.name}' is ready to move. Open the destination folder and choose Paste.`);
  };
  const paste = async () => {
    if (!os.clipboard) return;
    const r = await vfs.move(os.clipboard.nodeId, folderId);
    if (report(r)) {
      os.setClipboard(null);
      setNotice('');
    }
  };

  const properties = () => {
    const n = sel ?? folder;
    if (!n) return;
    const attrs = [n.readOnly ? 'Read-only' : null, n.hidden ? 'Hidden' : null, n.system ? 'System' : null].filter(Boolean).join(', ') || 'None';
    void os.message({
      title: `${n.parentId === null ? 'C:' : n.name} Properties`,
      icon: n.kind === 'file' ? 'document' : 'folder',
      text: [
        `Type: ${typeLabel(n)}`,
        `Location: ${n.parentId ? vfs.getDisplayPath(n.parentId) : 'My Computer'}`,
        n.kind === 'file' ? `Size: ${formatSize(n.sizeBytes)} (${n.sizeBytes.toLocaleString('en-US')} bytes)` : `Contains: ${vfs.listChildren(n.id).length} item(s)`,
        `Created: ${formatDate(n.createdAt)}`,
        `Modified: ${formatDate(n.updatedAt)}`,
        `Attributes: ${attrs}`,
      ],
    });
  };

  const onListKey = (e: KeyboardEvent) => {
    if (renaming) return;
    const idx = selected ? children.findIndex((c) => c.id === selected) : -1;
    const move = (i: number) => {
      const c = children[Math.max(0, Math.min(children.length - 1, i))];
      if (c) {
        setSelected(c.id);
        document.getElementById(`${windowId}-opt-${c.id}`)?.scrollIntoView({ block: 'nearest' });
      }
    };
    if (e.key === 'ArrowDown') { e.preventDefault(); move(idx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(idx <= 0 ? 0 : idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); move(0); }
    else if (e.key === 'End') { e.preventDefault(); move(children.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); openSelected(); }
    else if (e.key === 'Backspace') { e.preventDefault(); goUp(); }
    else if (e.key === 'Delete') { e.preventDefault(); void deleteSelected(); }
    else if (e.key === 'F2') { e.preventDefault(); startRename(); }
    else if (e.key === 'ArrowLeft' && e.altKey) { e.preventDefault(); goBack(); }
    else if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); goFwd(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') { e.preventDefault(); cut(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); void paste(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /\S/.test(e.key)) {
      const now = Date.now();
      const t = typeahead.current;
      t.text = now - t.at > 800 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      const hit = children.find((c) => c.name.toLowerCase().startsWith(t.text));
      if (hit) setSelected(hit.id);
    }
  };

  const revealedSecret = vfs.isAccessible(SEED_IDS.secret);
  const totalBytes = children.reduce((s, c) => s + (c.kind === 'file' ? c.sizeBytes : 0), 0);

  return (
    <div className="app explorer">
      <MenuBar
        label="Explorer menu"
        menus={[
          {
            label: 'File',
            items: [
              { label: 'Open', shortcut: 'Enter', action: openSelected, disabled: !sel },
              { separator: true, label: '' },
              { label: 'New Folder', action: () => void newItem('folder'), disabled: !!folder?.readOnly },
              { label: 'New Text Document', action: () => void newItem('text'), disabled: !!folder?.readOnly },
              { separator: true, label: '' },
              { label: 'Delete', shortcut: 'Del', action: () => void deleteSelected(), disabled: !sel },
              { label: 'Rename', shortcut: 'F2', action: startRename, disabled: !sel },
              { label: 'Properties', action: properties },
              { separator: true, label: '' },
              { label: 'Close', action: () => void os.requestClose(windowId) },
            ],
          },
          {
            label: 'Edit',
            items: [
              { label: 'Cut', shortcut: 'Ctrl+X', action: cut, disabled: !sel },
              { label: 'Paste', shortcut: 'Ctrl+V', action: () => void paste(), disabled: !os.clipboard },
            ],
          },
          {
            label: 'Go',
            items: [
              { label: 'Back', shortcut: 'Alt+←', action: goBack, disabled: back.length === 0 },
              { label: 'Forward', shortcut: 'Alt+→', action: goFwd, disabled: fwd.length === 0 },
              { label: 'Up One Level', shortcut: 'Backspace', action: goUp, disabled: !folder?.parentId },
              { separator: true, label: '' },
              { label: 'My Documents', action: () => navigate(SEED_IDS.docs) },
              { label: 'My Computer', action: () => navigate(ROOT_ID) },
            ],
          },
          {
            label: 'Help',
            items: [
              { label: 'Hints...', action: () => os.openApp('help', { tab: 'hints' }) },
              { label: revealedSecret ? 'Open TOP_SECRET' : 'Open SYSADMIN-99 Vault...', action: () => (revealedSecret ? navigate(SEED_IDS.secret) : os.openApp('vault')) },
              { label: 'About Windows', action: () => os.openApp('help', { tab: 'about' }) },
            ],
          },
        ]}
      />
      <div className="toolbar" role="toolbar" aria-label="Standard buttons">
        <button onClick={goBack} disabled={back.length === 0} aria-label="Back">◄ Back</button>
        <button onClick={goFwd} disabled={fwd.length === 0} aria-label="Forward">Forward ►</button>
        <button onClick={goUp} disabled={!folder?.parentId} aria-label="Up one level">▲ Up</button>
        <span className="toolbar-sep" aria-hidden="true" />
        <button onClick={cut} disabled={!sel}>Cut</button>
        <button onClick={() => void paste()} disabled={!os.clipboard}>Paste</button>
        <button onClick={() => void deleteSelected()} disabled={!sel}>Delete</button>
        <button onClick={properties}>Properties</button>
      </div>
      <form
        className="addressbar"
        onSubmit={(e) => {
          e.preventDefault();
          const r = vfs.resolvePath(address);
          if (r.ok) navigate(r.value);
          else void os.message({ title: 'Address', icon: 'error', text: r.error.message }).then(() => setAddress(path));
        }}
      >
        <label htmlFor={`${windowId}-addr`}>Address</label>
        <input id={`${windowId}-addr`} type="text" value={address} maxLength={260} onChange={(e) => setAddress(e.target.value)} spellCheck={false} />
        <button type="submit">Go</button>
      </form>
      <div className="filelist-wrap sunken-panel">
        <div className="filelist-header" aria-hidden="true">
          <span>Name</span>
          <span>Size</span>
          <span>Type</span>
          <span>Modified</span>
        </div>
        <div
          ref={listRef}
          className="filelist"
          role="listbox"
          aria-label={`Contents of ${path}`}
          tabIndex={0}
          data-autofocus="true"
          aria-activedescendant={selected ? `${windowId}-opt-${selected}` : undefined}
          onKeyDown={onListKey}
          onFocus={() => {
            if (!selected && children[0]) setSelected(children[0].id);
          }}
        >
          {children.length === 0 && <div className="filelist-empty">This folder is empty.</div>}
          {children.map((c: FsNode) => (
            <div
              key={c.id}
              id={`${windowId}-opt-${c.id}`}
              role="option"
              aria-selected={selected === c.id}
              className={`filerow${selected === c.id ? ' selected' : ''}${os.clipboard?.nodeId === c.id ? ' cut' : ''}`}
              onClick={() => setSelected(c.id)}
              onDoubleClick={() => (c.kind === 'file' ? os.openNode(c.id) : navigate(c.id))}
            >
              <span className="filerow-name">
                <Icon name={iconFor(c)} size={16} />
                {renaming === c.id ? (
                  <input
                    className="rename-input"
                    aria-label={`Rename ${c.name}`}
                    value={renameText}
                    autoFocus
                    maxLength={80}
                    onChange={(e) => setRenameText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') { e.preventDefault(); void commitRename(); }
                      if (e.key === 'Escape') { e.preventDefault(); renameCancelled.current = true; setRenaming(null); listRef.current?.focus(); }
                    }}
                    onBlur={() => void commitRename()}
                  />
                ) : (
                  <span>{c.name}</span>
                )}
              </span>
              <span>{c.kind === 'file' ? formatSize(c.sizeBytes) : ''}</span>
              <span>{typeLabel(c)}</span>
              <span>{formatDate(c.updatedAt)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="status-bar">
        <p className="status-bar-field" role="status">{notice || (sel ? `${typeLabel(sel)}${sel.readOnly ? ' (Read-only)' : ''}` : `${children.length} object(s)`)}</p>
        <p className="status-bar-field">{formatSize(totalBytes)}</p>
        <p className="status-bar-field">{os.storageKind === 'memory' ? 'Session only' : 'My Computer'}</p>
      </div>
    </div>
  );
}
