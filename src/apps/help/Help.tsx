import { useState } from 'react';
import { nextHint, progressOf } from '../../domain/story/engine';
import { useOs } from '../../os/OsContext';
import type { AppProps } from '../../shell/appRegistry';

const REPO_URL = 'https://github.com/jatinkrmahato993203/IIT-BHILAI';

export default function Help({ args }: AppProps) {
  const os = useOs();
  const isTab = (t: string | undefined): t is string => t === 'hints' || t === 'about' || t === 'keys';
  const [tab, setTab] = useState(isTab(args.tab) ? args.tab : 'keys');
  const [level, setLevel] = useState(0);
  const progress = progressOf(os.story);
  // Adjust state when inputs change (React "derive during render" pattern, no effect needed).
  const [seenArg, setSeenArg] = useState(args.tab);
  if (args.tab !== seenArg) {
    setSeenArg(args.tab);
    if (isTab(args.tab)) setTab(args.tab);
  }
  const [seenProgress, setSeenProgress] = useState(progress);
  if (progress !== seenProgress) {
    setSeenProgress(progress);
    setLevel(0);
  }
  const hint = nextHint(os.story, level);
  const tabs: [string, string][] = [['keys', 'Using this computer'], ['hints', 'Hints'], ['about', 'About & privacy']];

  return (
    <div className="app help">
      <menu role="tablist" aria-label="Help topics">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" id={`help-tab-${id}`} aria-selected={tab === id} aria-controls={`help-panel-${id}`} tabIndex={tab === id ? 0 : -1} data-autofocus={tab === id ? 'true' : undefined}
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((t) => t[0] === tab);
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0];
                setTab(n);
                requestAnimationFrame(() => document.getElementById(`help-tab-${n}`)?.focus());
              }
            }}>
            {label}
          </button>
        ))}
      </menu>
      <div className="window help-panel" role="tabpanel" id={`help-panel-${tab}`} aria-labelledby={`help-tab-${tab}`}>
        <div className="window-body">
          {tab === 'keys' && (
            <>
              <h2>Welcome to Aarav's computer</h2>
              <p>Explore the files, read what was left behind and find out what happened at midnight on 31 December 1999.</p>
              <h3>Mouse</h3>
              <ul>
                <li>Double-click icons and files to open them. Drag title bars to move windows; drag the bottom-right corner to resize.</li>
                <li>Right-click the desktop for a rescue menu (Arrange All Windows).</li>
              </ul>
              <h3>Keyboard</h3>
              <ul>
                <li><kbd>Tab</kbd> moves between areas, arrow keys move inside lists and menus, <kbd>Enter</kbd> opens.</li>
                <li><kbd>Ctrl</kbd>+<kbd>Esc</kbd> opens the Start menu. <kbd>Esc</kbd> closes menus and dialogs.</li>
                <li>Window menu (icon at the top-left of each window): Move/Size with arrow keys, Enter to accept, Esc to cancel.</li>
                <li><kbd>Ctrl</kbd>+<kbd>F4</kbd> closes the current window. Taskbar buttons switch between windows.</li>
                <li>Explorer: <kbd>Backspace</kbd> up, <kbd>F2</kbd> rename, <kbd>Del</kbd> delete, <kbd>Ctrl</kbd>+<kbd>X</kbd>/<kbd>V</kbd> move. Notepad: <kbd>Ctrl</kbd>+<kbd>S</kbd> save, <kbd>F5</kbd> date.</li>
              </ul>
              <p>No sound or timing is needed for any clue. Control Panel has text size, reduced motion and focus options.</p>
            </>
          )}
          {tab === 'hints' && (
            <>
              <h2>Hints</h2>
              <p>Mystery progress: <strong>{progress} of 5</strong></p>
              <div className="hint-box" role="status" aria-live="polite">
                <strong>{hint.title}</strong>
                <p>{hint.text}</p>
              </div>
              {progress < 5 && (
                <button onClick={() => setLevel((l) => Math.min(2, l + 1))} disabled={level >= 2}>
                  {level >= 2 ? 'That is the full answer' : 'I need a bigger hint'}
                </button>
              )}
            </>
          )}
          {tab === 'about' && (
            <>
              <h2>The Last Login</h2>
              <p>A fan-made, Windows 98-inspired mystery built for the Gandhi Hackathon 2026. Not affiliated with or endorsed by Microsoft. All characters are fictional.</p>
              <h3>Privacy</h3>
              <p>Your virtual files, progress and settings are stored locally in your browser. They are not uploaded to a server. Clearing site data or private browsing may erase progress. No account is needed.</p>
              <p>Storage mode: {os.storageKind === 'indexeddb' ? 'saved in this browser' : 'session only (not saved)'}.</p>
              <h3>Credits</h3>
              <p>Styling based on 98.css by Jordan Scales (MIT licence). Icons, pictures, sounds and story are original to this project.</p>
              <p>
                Source code:{' '}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  {REPO_URL}
                </a>{' '}
                (opens in a new tab)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
