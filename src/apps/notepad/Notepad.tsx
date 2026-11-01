import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SEED_IDS } from '../../content/seed';
import { LIMITS, type NodeId } from '../../domain/fs/types';
import { useOs, useVfsVersion } from '../../os/OsContext';
import type { AppProps } from '../../shell/appRegistry';
import { FileDialog, type FileDialogResult } from '../../ui/FileDialog';
import { MenuBar } from '../../ui/MenuBar';
import { Modal } from '../../ui/Modal';
import { STORY_FILE_EVENTS } from '../terminal/commands';

type Doc = { fileId: NodeId | null; name: string; saved: string; revision: number; readOnly: boolean; folderId: NodeId };
type Dialog =
  | null
  | { kind: 'file'; mode: 'open' | 'save'; resolve: (r: FileDialogResult) => void }
  | { kind: 'ask-save'; resolve: (v: 'yes' | 'no' | 'cancel') => void }
  | { kind: 'conflict'; resolve: (v: 'reload' | 'copy' | 'cancel') => void }
  | { kind: 'replace'; name: string; resolve: (v: boolean) => void };

const UNTITLED: Doc = { fileId: null, name: 'Untitled', saved: '', revision: 0, readOnly: false, folderId: SEED_IDS.docs };

export default function Notepad({ windowId, args }: AppProps) {
  const os = useOs();
  const { vfs } = os;
  const version = useVfsVersion(vfs);
  const [doc, setDoc] = useState<Doc>(UNTITLED);
  const [text, setText] = useState('');
  const [wrap, setWrap] = useState(true);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const dirty = text !== doc.saved;
  const latest = useRef({ doc, text, dirty });
  latest.current = { doc, text, dirty };

  const ask = <T,>(make: (resolve: (v: T) => void) => Dialog) => new Promise<T>((resolve) => setDialog(make((v: T) => { setDialog(null); resolve(v); })));

  const load = useCallback(
    (id: NodeId) => {
      const r = vfs.readText(id);
      if (!r.ok) {
        void os.message({ title: 'Notepad', icon: 'error', text: r.error.message });
        return false;
      }
      const n = r.value.node;
      setDoc({ fileId: id, name: n.name, saved: r.value.text, revision: r.value.revision, readOnly: !!n.readOnly, folderId: n.parentId ?? SEED_IDS.docs });
      setText(r.value.text);
      const ev = STORY_FILE_EVENTS[id];
      if (ev) os.emit(ev);
      requestAnimationFrame(() => {
        area.current?.setSelectionRange(0, 0);
        if (area.current) area.current.scrollTop = 0;
      });
      return true;
    },
    [os, vfs],
  );

  useEffect(() => {
    if (args.fileId) load(args.fileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Another window saved this file: silently pick up the change if we have no edits.
  useEffect(() => {
    const { doc: d, dirty: isDirty } = latest.current;
    if (!d.fileId) return;
    const n = vfs.getNode(d.fileId);
    if (n && n.revision !== d.revision && !isDirty && vfs.isAccessible(n.id)) {
      const r = vfs.readText(n.id);
      if (r.ok) {
        setDoc((x) => ({ ...x, saved: r.value.text, revision: r.value.revision, name: n.name, readOnly: !!n.readOnly }));
        setText(r.value.text);
      }
    } else if (n && n.name !== d.name) setDoc((x) => ({ ...x, name: n.name }));
  }, [version, vfs]);

  useEffect(() => {
    os.setTitle(windowId, `${doc.name}${dirty ? '*' : ''} - Notepad`);
    os.setDirty(windowId, dirty);
  }, [os, windowId, doc.name, dirty]);

  const saveAs = useCallback(async (): Promise<boolean> => {
    const { text: t } = latest.current;
    const choice = await ask<FileDialogResult>((resolve) => ({ kind: 'file', mode: 'save', resolve }));
    if (!choice) return false;
    setBusy(true);
    try {
      if (choice.existingId) {
        const existing = vfs.getNode(choice.existingId);
        if (!existing) return false;
        const replace = await ask<boolean>((resolve) => ({ kind: 'replace', name: existing.name, resolve }));
        if (!replace) return false;
        const r = await vfs.writeText(existing.id, t, existing.revision);
        if (!r.ok) {
          await os.message({ title: 'Notepad', icon: 'error', text: r.error.message });
          return false;
        }
        setDoc({ fileId: existing.id, name: existing.name, saved: t, revision: r.value.revision, readOnly: false, folderId: choice.folderId });
        return true;
      }
      const r = await vfs.createText(choice.folderId, choice.name, t);
      if (!r.ok) {
        await os.message({ title: 'Notepad', icon: 'error', text: r.error.message });
        return false;
      }
      setDoc({ fileId: r.value.id, name: r.value.name, saved: t, revision: r.value.revision, readOnly: false, folderId: choice.folderId });
      return true;
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [os, vfs]);

  const save = useCallback(async (): Promise<boolean> => {
    const { doc: d, text: t } = latest.current;
    if (!d.fileId) return saveAs();
    if (d.readOnly) {
      await os.message({ title: 'Notepad', icon: 'warning', text: [`'${d.name}' is read-only.`, 'Use Save As to save your own copy.'] });
      return saveAs();
    }
    setBusy(true);
    performance.mark?.('notepad-save-start');
    const r = await vfs.writeText(d.fileId, t, d.revision);
    setBusy(false);
    if (r.ok) {
      performance.mark?.('notepad-save-committed');
      setDoc((x) => ({ ...x, saved: t, revision: r.value.revision }));
      return true;
    }
    if (r.error.code === 'CONFLICT') {
      const c = await ask<'reload' | 'copy' | 'cancel'>((resolve) => ({ kind: 'conflict', resolve }));
      if (c === 'reload' && d.fileId) return load(d.fileId) && false;
      if (c === 'copy') return saveAs();
      return false;
    }
    if (r.error.code === 'NOT_FOUND') {
      await os.message({ title: 'Notepad', icon: 'warning', text: [r.error.message] });
      return saveAs();
    }
    await os.message({ title: 'Notepad', icon: 'error', text: r.error.message });
    return false;
  }, [load, os, saveAs, vfs]);

  /** Returns false if the user cancelled. */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!latest.current.dirty) return true;
    const v = await ask<'yes' | 'no' | 'cancel'>((resolve) => ({ kind: 'ask-save', resolve }));
    if (v === 'cancel') return false;
    if (v === 'yes') return save();
    return true;
  }, [save]);

  useEffect(() => {
    os.registerCloseGuard(windowId, confirmDiscard);
    return () => os.registerCloseGuard(windowId, null);
  }, [os, windowId, confirmDiscard]);

  const newDoc = async () => {
    if (!(await confirmDiscard())) return;
    setDoc({ ...UNTITLED, folderId: latest.current.doc.folderId });
    setText('');
    area.current?.focus();
  };
  const open = async () => {
    if (!(await confirmDiscard())) return;
    const r = await ask<FileDialogResult>((resolve) => ({ kind: 'file', mode: 'open', resolve }));
    if (r?.existingId) load(r.existingId);
    area.current?.focus();
  };

  const insertDate = () => {
    const el = area.current;
    const stamp = '11:58 PM 12/31/1999';
    if (!el) return;
    const s = el.selectionStart ?? text.length;
    const e = el.selectionEnd ?? text.length;
    const next = text.slice(0, s) + stamp + text.slice(e);
    if (next.length > LIMITS.textMaxBytes) return;
    setText(next);
    requestAnimationFrame(() => el.setSelectionRange(s + stamp.length, s + stamp.length));
  };

  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 's') {
      e.preventDefault();
      if (!busy) void save();
    } else if ((e.ctrlKey || e.metaKey) && k === 'o') {
      e.preventDefault();
      void open();
    } else if (e.key === 'F5') {
      e.preventDefault();
      insertDate();
    }
  };

  return (
    <div className="app notepad" onKeyDown={onKey}>
      <MenuBar
        label="Notepad menu"
        menus={[
          {
            label: 'File',
            items: [
              { label: 'New', action: () => void newDoc() },
              { label: 'Open...', shortcut: 'Ctrl+O', action: () => void open() },
              { label: 'Save', shortcut: 'Ctrl+S', action: () => void save(), disabled: busy },
              { label: 'Save As...', action: () => void saveAs(), disabled: busy },
              { separator: true, label: '' },
              { label: 'Exit', action: () => void os.requestClose(windowId) },
            ],
          },
          {
            label: 'Edit',
            items: [
              { label: 'Select All', shortcut: 'Ctrl+A', action: () => area.current?.select() },
              { label: 'Time/Date', shortcut: 'F5', action: insertDate },
            ],
          },
          { label: 'Format', items: [{ label: 'Word Wrap', checked: wrap, action: () => setWrap((w) => !w) }] },
          {
            label: 'Help',
            items: [
              { label: 'About Notepad', action: () => void os.message({ title: 'About Notepad', icon: 'notepad', text: ['Notepad (fan-made recreation)', 'Your text is stored only in this browser.', `Maximum file size: ${LIMITS.textMaxBytes / 1024} KB.`] }) },
            ],
          },
        ]}
      />
      {doc.readOnly && (
        <div className="infobar" role="note">
          This file is read-only. You can still read it — use File &gt; Save As to keep your own copy.
        </div>
      )}
      <textarea
        ref={area}
        className="notepad-text"
        aria-label={`Text of ${doc.name}`}
        data-autofocus="true"
        value={text}
        spellCheck={false}
        wrap={wrap ? 'soft' : 'off'}
        maxLength={LIMITS.textMaxBytes}
        onChange={(e) => setText(e.target.value)}
      />
      {busy && <div className="visually-hidden" role="status">Saving…</div>}

      {dialog?.kind === 'file' && (
        <FileDialog vfs={vfs} mode={dialog.mode} initialFolder={doc.folderId} initialName={dialog.mode === 'save' ? (doc.fileId && !doc.readOnly ? doc.name : doc.fileId ? `copy of ${doc.name}` : '') : ''} onDone={dialog.resolve} />
      )}
      {dialog?.kind === 'ask-save' && (
        <Modal
          title="Notepad"
          scope="window"
          icon="warning"
          cancelValue="cancel"
          buttons={[
            { label: 'Yes', value: 'yes', primary: true },
            { label: 'No', value: 'no' },
            { label: 'Cancel', value: 'cancel' },
          ]}
          onResult={(v) => dialog.resolve(v as 'yes' | 'no' | 'cancel')}
        >
          <p>The text in the {doc.fileId ? doc.name : 'Untitled'} file has changed.</p>
          <p>Do you want to save the changes?</p>
        </Modal>
      )}
      {dialog?.kind === 'conflict' && (
        <Modal
          title="Notepad"
          scope="window"
          icon="warning"
          cancelValue="cancel"
          width={400}
          buttons={[
            { label: 'Reload', value: 'reload' },
            { label: 'Save As Copy', value: 'copy', primary: true },
            { label: 'Cancel', value: 'cancel' },
          ]}
          onResult={(v) => dialog.resolve(v as 'reload' | 'copy' | 'cancel')}
        >
          <p>'{doc.name}' was changed in another window since you opened it.</p>
          <p>Reload discards your edits. Save As Copy keeps both versions.</p>
        </Modal>
      )}
      {dialog?.kind === 'replace' && (
        <Modal
          title="Save As"
          scope="window"
          icon="warning"
          cancelValue="no"
          buttons={[
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no', primary: true },
          ]}
          onResult={(v) => dialog.resolve(v === 'yes')}
        >
          <p>{dialog.name} already exists.</p>
          <p>Do you want to replace it?</p>
        </Modal>
      )}
    </div>
  );
}
