import { useMemo, useState } from 'react';
import { ROOT_ID, type NodeId } from '../domain/fs/types';
import type { VfsService } from '../domain/fs/service';
import { validateName } from '../domain/fs/validation';
import { formatSize, iconFor } from './format';
import { Icon } from './icons';
import { Modal } from './Modal';

export type FileDialogResult = { folderId: NodeId; name: string; existingId?: NodeId } | null;

/** Virtual Open / Save As picker. Only ever lists the virtual C: drive. */
export function FileDialog({ vfs, mode, initialFolder, initialName = '', onDone }: {
  vfs: VfsService;
  mode: 'open' | 'save';
  initialFolder: NodeId;
  initialName?: string;
  onDone: (r: FileDialogResult) => void;
}) {
  const [folder, setFolder] = useState<NodeId>(vfs.isAccessible(initialFolder) ? initialFolder : ROOT_ID);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const items = useMemo(() => vfs.listChildren(folder).filter((n) => n.kind !== 'file' || n.mimeType === 'text/plain'), [vfs, folder]);
  const node = vfs.getNode(folder);

  const submit = () => {
    setError('');
    let target = folder;
    let fname = name.trim();
    // Allow typing a full path like C:\My Documents\note.txt
    if (/^[a-z]:/i.test(fname)) {
      const cut = fname.lastIndexOf('\\') > fname.lastIndexOf('/') ? fname.lastIndexOf('\\') : fname.lastIndexOf('/');
      const dir = cut > 2 ? fname.slice(0, cut) : fname.slice(0, 3);
      const base = fname.slice(cut + 1);
      const r = vfs.resolvePath(dir);
      if (!r.ok) return setError(r.error.message);
      const dirNode = vfs.getNode(r.value);
      if (!dirNode || dirNode.kind === 'file') return setError('That folder does not exist.');
      if (!base) {
        setFolder(r.value);
        setName('');
        return;
      }
      target = r.value;
      fname = base;
    }
    if (mode === 'save' && fname && !/\.[^.\s]+$/.test(fname)) fname += '.txt';
    const v = validateName(fname);
    if (!v.ok) return setError(v.error.message);
    const existing = vfs.listChildren(target).find((n) => n.name.toLowerCase() === v.value.toLowerCase());
    if (existing && existing.kind !== 'file') {
      setFolder(existing.id);
      setName('');
      return;
    }
    if (mode === 'open') {
      if (!existing) return setError(`${v.value}\nFile not found. Please verify the correct file name was given.`);
      if (existing.mimeType !== 'text/plain') return setError('Notepad can only open text documents.');
      return onDone({ folderId: target, name: existing.name, existingId: existing.id });
    }
    onDone({ folderId: target, name: v.value, existingId: existing?.id });
  };

  return (
    <Modal
      title={mode === 'open' ? 'Open' : 'Save As'}
      scope="window"
      width={380}
      cancelValue="cancel"
      initialFocus="first-input"
      buttons={[
        { label: mode === 'open' ? 'Open' : 'Save', value: 'ok', primary: true },
        { label: 'Cancel', value: 'cancel' },
      ]}
      onResult={(v) => (v === 'ok' ? submit() : onDone(null))}
    >
      <div className="filedialog">
        <div className="field-row filedialog-look">
          <span>{mode === 'open' ? 'Look in:' : 'Save in:'}</span>
          <strong className="filedialog-path">{vfs.getDisplayPath(folder)}</strong>
          <button type="button" aria-label="Up one level" disabled={!node?.parentId} onClick={() => node?.parentId && setFolder(node.parentId)}>
            ▲
          </button>
        </div>
        <ul className="filedialog-list sunken-panel" aria-label="Folder contents">
          {items.length === 0 && <li className="filelist-empty">(empty)</li>}
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="filedialog-item"
                onClick={() => (n.kind === 'file' ? setName(n.name) : setFolder(n.id))}
                onDoubleClick={() => {
                  if (n.kind === 'file') {
                    if (mode === 'open') onDone({ folderId: folder, name: n.name, existingId: n.id });
                    else setName(n.name);
                  }
                }}
              >
                <Icon name={iconFor(n)} size={16} /> {n.name}
                {n.kind === 'file' && <span className="small"> — {formatSize(n.sizeBytes)}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="field-row">
          <label htmlFor="fd-name">File name:</label>
          <input
            id="fd-name"
            type="text"
            value={name}
            maxLength={260}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            style={{ flex: 1 }}
          />
        </div>
        <p className="small">Files of type: Text Documents (*.txt)</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
