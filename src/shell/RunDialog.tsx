import { useState } from 'react';
import { useOs } from '../os/OsContext';
import { Modal } from '../ui/Modal';
import type { AppId } from './appIds';

const COMMANDS: Record<string, AppId> = {
  notepad: 'notepad', 'notepad.exe': 'notepad', calc: 'calculator', 'calc.exe': 'calculator', command: 'terminal', 'command.com': 'terminal',
  cmd: 'terminal', explorer: 'explorer', 'explorer.exe': 'explorer', iexplore: 'browser', 'iexplore.exe': 'browser', control: 'control',
  winhelp: 'help', sysadmin99: 'vault', 'sysadmin99.exe': 'vault', vault: 'vault',
};

export function RunDialog({ onClose }: { onClose: () => void }) {
  const os = useOs();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const v = value.trim().slice(0, 260);
    if (!v) return;
    const app = COMMANDS[v.toLowerCase()];
    if (app) {
      onClose();
      os.openApp(app);
      return;
    }
    if (/^retro:\/\//i.test(v) || /^https?:\/\//i.test(v)) {
      onClose();
      os.openApp('browser', { address: v });
      return;
    }
    if (/^[a-z]:/i.test(v)) {
      const r = os.vfs.resolvePath(v);
      if (r.ok) {
        onClose();
        os.openNode(r.value);
        return;
      }
      setError(r.error.message);
      return;
    }
    setError(`Cannot find the file '${v}' (or one of its components). Make sure the path and filename are correct.`);
  };

  return (
    <Modal
      title="Run"
      icon="run"
      cancelValue="cancel"
      initialFocus="first-input"
      width={380}
      buttons={[
        { label: 'OK', value: 'ok', primary: true },
        { label: 'Cancel', value: 'cancel' },
      ]}
      onResult={(r) => (r === 'ok' ? submit() : onClose())}
    >
      <p>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</p>
      <div className="field-row">
        <label htmlFor="run-input">Open:</label>
        <input
          id="run-input"
          type="text"
          value={value}
          maxLength={260}
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
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
      <p className="small">Try: notepad, calc, command, C:\My Documents, retro://home</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
