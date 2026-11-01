import { useEffect, useRef, useState } from 'react';
import { ROOT_ID } from '../../domain/fs/types';
import { useOs, useVfsVersion } from '../../os/OsContext';
import type { AppProps } from '../../shell/appRegistry';
import { MAX_INPUT, MAX_OUTPUT_LINES, runCommand } from './commands';

const BANNER = ['', 'Microsoft(R)-ish Windows 98 (fan-made simulation)', '   (C) Copyright Aarav Industries 1998-1999.', 'Type HELP for a list of commands.', ''];

export default function Terminal({ windowId }: AppProps) {
  const os = useOs();
  const [lines, setLines] = useState<string[]>(BANNER);
  const [storedCwd, setCwd] = useState(ROOT_ID);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const [verCount, setVerCount] = useState(0);
  const out = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useVfsVersion(os.vfs);
  // If the current directory disappears (deleted, hidden again after a replay), fall back to C:\.
  const cwd = os.vfs.isAccessible(storedCwd) ? storedCwd : ROOT_ID;
  const prompt = `${os.vfs.getDisplayPath(cwd)}>`;

  useEffect(() => {
    out.current?.scrollTo({ top: out.current.scrollHeight });
  }, [lines]);

  const submit = () => {
    const cmd = input;
    setInput('');
    setHIdx(-1);
    if (cmd.trim()) setHistory((h) => [...h.slice(-49), cmd]);
    const r = runCommand(cmd, {
      vfs: os.vfs,
      cwd,
      story: os.story,
      verCount,
      emit: os.emit,
      launch: (app, args) => os.openApp(app, args),
    });
    if (r.verCount !== undefined) setVerCount(r.verCount);
    if (r.cwd) setCwd(r.cwd);
    if (r.exit) {
      void os.requestClose(windowId);
      return;
    }
    setLines((l) => (r.clear ? [] : [...l, `${prompt}${cmd}`, ...r.lines].slice(-MAX_OUTPUT_LINES)));
  };

  return (
    <div className="app terminal" onClick={() => window.getSelection()?.isCollapsed && inputRef.current?.focus()}>
      <div className="terminal-out" ref={out} role="log" aria-label="MS-DOS output" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className="terminal-line">
            {l || '\u00a0'}
          </div>
        ))}
        <form
          className="terminal-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor={`${windowId}-cmd`} className="terminal-prompt">
            {prompt}
          </label>
          <input
            ref={inputRef}
            id={`${windowId}-cmd`}
            className="terminal-input"
            data-autofocus="true"
            value={input}
            maxLength={MAX_INPUT}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' && history.length) {
                e.preventDefault();
                const i = hIdx === -1 ? history.length - 1 : Math.max(0, hIdx - 1);
                setHIdx(i);
                setInput(history[i]);
              } else if (e.key === 'ArrowDown' && hIdx !== -1) {
                e.preventDefault();
                const i = hIdx + 1;
                if (i >= history.length) {
                  setHIdx(-1);
                  setInput('');
                } else {
                  setHIdx(i);
                  setInput(history[i]);
                }
              } else if (e.key === 'Escape') {
                setInput('');
              }
            }}
          />
        </form>
      </div>
    </div>
  );
}
