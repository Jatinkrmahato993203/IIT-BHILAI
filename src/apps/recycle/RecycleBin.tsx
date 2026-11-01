import { useState } from 'react';
import { useOs, useVfsVersion } from '../../os/OsContext';
import type { AppProps } from '../../shell/appRegistry';
import { formatDate, formatSize, iconFor } from '../../ui/format';
import { Icon } from '../../ui/icons';

export default function RecycleBin({ windowId }: AppProps) {
  const os = useOs();
  const { vfs } = os;
  useVfsVersion(vfs);
  const items = vfs.listDeleted();
  const [selected, setSelected] = useState<string | null>(null);
  const sel = items.find((i) => i.id === selected) ?? null;

  const origin = (id: string | null | undefined) => {
    if (!id || !vfs.getNode(id) || !vfs.isAccessible(id)) return 'C:\\ (original folder is gone)';
    return vfs.getDisplayPath(id);
  };

  const restore = async () => {
    if (!sel) return;
    let r = await vfs.restore(sel.id);
    if (!r.ok && r.error.code === 'DUPLICATE') {
      const v = await os.message({
        title: 'Confirm File Replace',
        icon: 'question',
        text: [r.error.message, 'Restore it with a new name instead?'],
        buttons: [
          { label: 'Restore as copy', value: 'rename', primary: true },
          { label: 'Cancel', value: 'cancel' },
        ],
        cancelValue: 'cancel',
      });
      if (v !== 'rename') return;
      r = await vfs.restore(sel.id, { onCollision: 'rename' });
    }
    if (!r.ok) {
      void os.message({ title: 'Error', icon: 'error', text: r.error.message });
      return;
    }
    setSelected(null);
    void os.message({ title: 'Recycle Bin', icon: 'info', text: `'${r.value.name}' was restored to ${vfs.getDisplayPath(r.value.parentId!)}.` });
  };

  const purge = async () => {
    if (!sel) return;
    const v = await os.message({
      title: 'Confirm File Delete',
      icon: 'warning',
      text: `Are you sure you want to permanently delete '${sel.name}'? This cannot be undone.`,
      buttons: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no', primary: true },
      ],
      cancelValue: 'no',
    });
    if (v !== 'yes') return;
    const r = await vfs.purge(sel.id);
    if (!r.ok) void os.message({ title: 'Error', icon: 'error', text: r.error.message });
    setSelected(null);
  };

  const empty = async () => {
    if (items.length === 0) return;
    const v = await os.message({
      title: 'Confirm Multiple File Delete',
      icon: 'warning',
      text: `Are you sure you want to permanently delete these ${items.length} item(s)?`,
      buttons: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no', primary: true },
      ],
      cancelValue: 'no',
    });
    if (v !== 'yes') return;
    const r = await vfs.emptyRecycleBin();
    if (!r.ok) void os.message({ title: 'Error', icon: 'error', text: r.error.message });
  };

  return (
    <div className="app recycle">
      <div className="toolbar" role="toolbar" aria-label="Recycle Bin actions">
        <button onClick={() => void restore()} disabled={!sel} data-autofocus={items.length ? undefined : 'true'}>Restore</button>
        <button onClick={() => void purge()} disabled={!sel}>Delete</button>
        <button onClick={() => void empty()} disabled={items.length === 0}>Empty Recycle Bin</button>
      </div>
      <div className="filelist-wrap sunken-panel">
        <div className="filelist-header recycle-header" aria-hidden="true">
          <span>Name</span>
          <span>Original Location</span>
          <span>Date Deleted</span>
          <span>Size</span>
        </div>
        <div
          className="filelist"
          role="listbox"
          aria-label="Deleted items"
          tabIndex={0}
          data-autofocus={items.length ? 'true' : undefined}
          aria-activedescendant={sel ? `${windowId}-rb-${sel.id}` : undefined}
          onFocus={() => !selected && items[0] && setSelected(items[0].id)}
          onKeyDown={(e) => {
            const i = sel ? items.indexOf(sel) : -1;
            if (e.key === 'ArrowDown') { e.preventDefault(); const n = items[Math.min(items.length - 1, i + 1)]; if (n) setSelected(n.id); }
            if (e.key === 'ArrowUp') { e.preventDefault(); const n = items[Math.max(0, i - 1)]; if (n) setSelected(n.id); }
            if (e.key === 'Enter') { e.preventDefault(); void restore(); }
            if (e.key === 'Delete') { e.preventDefault(); void purge(); }
          }}
        >
          {items.length === 0 && <div className="filelist-empty">The Recycle Bin is empty.</div>}
          {items.map((n) => (
            <div
              key={n.id}
              id={`${windowId}-rb-${n.id}`}
              role="option"
              aria-selected={selected === n.id}
              className={`filerow recycle-row${selected === n.id ? ' selected' : ''}`}
              onClick={() => setSelected(n.id)}
              onDoubleClick={() => void restore()}
            >
              <span className="filerow-name">
                <Icon name={iconFor(n)} size={16} />
                <span>{n.name}</span>
              </span>
              <span>{origin(n.originalParentId)}</span>
              <span>{n.deletedAt ? formatDate(n.deletedAt) : ''}</span>
              <span>{n.kind === 'file' ? formatSize(n.sizeBytes) : ''}</span>
            </div>
          ))}
        </div>
      </div>
      {sel && sel.mimeType === 'text/plain' && (
        <div className="recycle-preview sunken-panel" aria-label="Preview">
          <pre>{(vfs.peekText(sel.id) ?? '').slice(0, 600)}</pre>
        </div>
      )}
      <div className="status-bar">
        <p className="status-bar-field" role="status">{items.length} object(s)</p>
        <p className="status-bar-field">Enter = Restore, Del = Delete permanently</p>
      </div>
    </div>
  );
}
