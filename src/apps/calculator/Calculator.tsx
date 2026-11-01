import { useReducer, type KeyboardEvent } from 'react';
import type { AppProps } from '../../shell/appRegistry';
import { MenuBar } from '../../ui/MenuBar';
import { useOs } from '../../os/OsContext';
import { calcReducer, initialCalc, keyToInput, type CalcInput } from './logic';

type Key = { label: string; input: CalcInput; aria?: string; cls?: string };

const KEYS: Key[][] = [
  [
    { label: 'MC', input: { type: 'memory', m: 'MC' }, aria: 'Memory clear', cls: 'red' },
    { label: '7', input: { type: 'digit', d: '7' } }, { label: '8', input: { type: 'digit', d: '8' } }, { label: '9', input: { type: 'digit', d: '9' } },
    { label: '/', input: { type: 'op', op: '/' }, aria: 'Divide', cls: 'red' },
    { label: 'sqrt', input: { type: 'sqrt' }, aria: 'Square root' },
  ],
  [
    { label: 'MR', input: { type: 'memory', m: 'MR' }, aria: 'Memory recall', cls: 'red' },
    { label: '4', input: { type: 'digit', d: '4' } }, { label: '5', input: { type: 'digit', d: '5' } }, { label: '6', input: { type: 'digit', d: '6' } },
    { label: '*', input: { type: 'op', op: '*' }, aria: 'Multiply', cls: 'red' },
    { label: '%', input: { type: 'percent' }, aria: 'Percent' },
  ],
  [
    { label: 'MS', input: { type: 'memory', m: 'MS' }, aria: 'Memory store', cls: 'red' },
    { label: '1', input: { type: 'digit', d: '1' } }, { label: '2', input: { type: 'digit', d: '2' } }, { label: '3', input: { type: 'digit', d: '3' } },
    { label: '-', input: { type: 'op', op: '-' }, aria: 'Subtract', cls: 'red' },
    { label: '1/x', input: { type: 'reciprocal' }, aria: 'Reciprocal' },
  ],
  [
    { label: 'M+', input: { type: 'memory', m: 'M+' }, aria: 'Memory add', cls: 'red' },
    { label: '0', input: { type: 'digit', d: '0' } },
    { label: '+/-', input: { type: 'negate' }, aria: 'Negate' },
    { label: '.', input: { type: 'dot' }, aria: 'Decimal point' },
    { label: '+', input: { type: 'op', op: '+' }, aria: 'Add', cls: 'red' },
    { label: '=', input: { type: 'equals' }, aria: 'Equals', cls: 'red' },
  ],
];

export default function Calculator({ windowId }: AppProps) {
  const os = useOs();
  const [s, send] = useReducer(calcReducer, undefined, initialCalc);
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('[role="menubar"]')) return;
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).tagName === 'BUTTON') return; // let buttons activate
    const input = keyToInput(e.key);
    if (input) {
      e.preventDefault();
      send(input);
    }
  };
  const y2k = s.display === '2000' || s.display === '1999';
  return (
    <div className="app calculator" onKeyDown={onKey} tabIndex={-1}>
      <MenuBar
        label="Calculator menu"
        menus={[
          { label: 'Edit', items: [{ label: 'Copy', shortcut: 'Ctrl+C', action: () => void navigator.clipboard?.writeText(s.display).catch(() => undefined) }] },
          { label: 'Help', items: [{ label: 'About Calculator', action: () => void os.message({ title: 'About Calculator', icon: 'calculator', text: ['Calculator (fan-made). Keyboard: digits, + - * /, Enter, Esc, Backspace, %.', 'Y2K compliant. Probably.'] }) }] },
        ]}
      />
      <div className="calc-display" role="status" aria-live="polite" aria-label={`Display: ${s.display}`} data-window={windowId}>
        {s.display}
      </div>
      <div className="calc-status" aria-hidden={!y2k}>{y2k ? (s.display === '2000' ? 'Y2K OK :)' : 'almost...') : s.memory !== 0 ? 'M' : ''}</div>
      <div className="calc-top">
        <button onClick={() => send({ type: 'backspace' })}>Back</button>
        <button onClick={() => send({ type: 'clearEntry' })} aria-label="Clear entry">CE</button>
        <button onClick={() => send({ type: 'clear' })} aria-label="Clear all" data-autofocus="true">C</button>
      </div>
      <div className="calc-grid">
        {KEYS.flat().map((k) => (
          <button key={k.label} className={k.cls} aria-label={k.aria ?? k.label} onClick={() => send(k.input)}>
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
