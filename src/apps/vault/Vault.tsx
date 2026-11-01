import { useState } from 'react';
import { SEED_IDS } from '../../content/seed';
import { checkPassword, has } from '../../domain/story/engine';
import { useOs } from '../../os/OsContext';
import type { AppProps } from '../../shell/appRegistry';

const DENIED = [
  'ACCESS DENIED. Nice try, Kabir.',
  'ACCESS DENIED. SYSADMIN-99 is disappointed but not surprised.',
  'ACCESS DENIED. Hint: the checklist knows. Item 7 knows.',
  'ACCESS DENIED. It is one word. It is the moment the world ends. ALL CAPS.',
];

export default function Vault(_props: AppProps) {
  const os = useOs();
  const [pw, setPw] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [msg, setMsg] = useState('');
  const unlocked = has(os.story, 'clue.secret-unlocked');
  const letter = has(os.story, 'clue.letter-read');

  if (unlocked)
    return (
      <div className="app vault">
        <pre className="vault-art" aria-hidden="true">{'  [ VAULT STATUS: OPEN ]\n   __________\n  |  ______  |\n  | |      | |\n  | |  :)  | |\n  |_|______|_|'}</pre>
        <p className="vault-line">C:\TOP_SECRET is visible. The floppy is safe. The courage is not.</p>
        <button className="vault-btn" data-autofocus="true" onClick={() => os.openApp('explorer', { folderId: SEED_IDS.secret })}>
          Open C:\TOP_SECRET
        </button>
      </div>
    );

  return (
    <div className="app vault">
      <pre className="vault-art" aria-hidden="true">{'  SYSADMIN-99 SECURE VAULT v0.99\n  ==============================\n  AUTHORISED PERSONNEL ONLY\n  (that means Aarav)'}</pre>
      <p className="vault-line">{letter ? 'Outbox message detected. Vault is awaiting the password.' : 'No authorised personnel detected. Status: locked, dramatic.'}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (checkPassword(pw)) {
            setMsg('ACCESS GRANTED.');
            os.emit('clue.secret-unlocked');
          } else {
            setMsg(DENIED[Math.min(attempts, DENIED.length - 1)]);
            setAttempts((a) => a + 1);
            os.playSound('error');
          }
          setPw('');
        }}
      >
        <label htmlFor="vault-pw" className="vault-line">
          PASSWORD:
        </label>
        <input
          id="vault-pw"
          className="vault-input"
          type="password"
          autoComplete="off"
          maxLength={64}
          data-autofocus="true"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button className="vault-btn" type="submit">
          AUTHENTICATE
        </button>
      </form>
      <p className="vault-line" role="status" aria-live="assertive">
        {msg}
      </p>
      <button className="vault-link" onClick={() => os.openApp('help', { tab: 'hints' })}>
        Forgot password? Ask for a hint
      </button>
    </div>
  );
}
