/** Pure calculator state machine. No eval; deterministic rounding to 12 significant digits. */
export type Op = '+' | '-' | '*' | '/';
export type CalcState = {
  display: string;
  acc: number | null;
  op: Op | null;
  /** True when the next digit starts a new number. */
  fresh: boolean;
  lastOp: Op | null;
  lastOperand: number | null;
  error: string | null;
  memory: number;
};

export type CalcInput =
  | { type: 'digit'; d: string }
  | { type: 'dot' }
  | { type: 'op'; op: Op }
  | { type: 'equals' }
  | { type: 'clear' }
  | { type: 'clearEntry' }
  | { type: 'backspace' }
  | { type: 'negate' }
  | { type: 'percent' }
  | { type: 'sqrt' }
  | { type: 'reciprocal' }
  | { type: 'memory'; m: 'MC' | 'MR' | 'MS' | 'M+' };

export const MAX_DIGITS = 16;

export const initialCalc = (): CalcState => ({
  display: '0', acc: null, op: null, fresh: true, lastOp: null, lastOperand: null, error: null, memory: 0,
});

export function formatNumber(n: number): string | null {
  if (!Number.isFinite(n)) return null;
  if (Object.is(n, -0)) n = 0;
  const rounded = Number.parseFloat(n.toPrecision(12));
  if (Math.abs(rounded) >= 1e16 || (Math.abs(rounded) < 1e-12 && rounded !== 0)) {
    return rounded.toExponential(8).replace(/\.?0+e/, 'e');
  }
  const s = String(rounded);
  if (s.includes('e')) return rounded.toExponential(8).replace(/\.?0+e/, 'e');
  return s;
}

function compute(a: number, op: Op, b: number): number | 'DIV0' {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? 'DIV0' : a / b;
  }
}

const withError = (s: CalcState, message: string): CalcState => ({ ...initialCalc(), memory: s.memory, display: message, error: message });

const current = (s: CalcState) => Number.parseFloat(s.display);

function setResult(s: CalcState, n: number | 'DIV0', patch: Partial<CalcState> = {}): CalcState {
  if (n === 'DIV0') return withError(s, 'Cannot divide by zero.');
  const f = formatNumber(n);
  if (f === null) return withError(s, 'Invalid input for function.');
  return { ...s, ...patch, display: f, fresh: true };
}

export function calcReducer(s: CalcState, input: CalcInput): CalcState {
  if (s.error && input.type !== 'clear' && input.type !== 'clearEntry' && input.type !== 'digit' && input.type !== 'dot') return s;
  if (s.error) s = { ...initialCalc(), memory: s.memory };
  switch (input.type) {
    case 'digit': {
      if (!/^[0-9]$/.test(input.d)) return s;
      if (s.fresh) return { ...s, display: input.d, fresh: false };
      if (s.display.replace(/[-.]/g, '').length >= MAX_DIGITS) return s;
      return { ...s, display: s.display === '0' ? input.d : s.display === '-0' ? '-' + input.d : s.display + input.d };
    }
    case 'dot':
      if (s.fresh) return { ...s, display: '0.', fresh: false };
      if (s.display.includes('.')) return s;
      return { ...s, display: s.display + '.' };
    case 'op': {
      if (s.op && !s.fresh && s.acc !== null) {
        const r = compute(s.acc, s.op, current(s));
        if (r === 'DIV0') return withError(s, 'Cannot divide by zero.');
        const next = setResult(s, r);
        if (next.error) return next;
        return { ...next, acc: Number.parseFloat(next.display), op: input.op, lastOp: null, lastOperand: null };
      }
      return { ...s, acc: current(s), op: input.op, fresh: true, lastOp: null, lastOperand: null };
    }
    case 'equals': {
      if (s.op && s.acc !== null) {
        const b = current(s);
        const r = compute(s.acc, s.op, b);
        return setResult(s, r, { acc: null, op: null, lastOp: s.op, lastOperand: b });
      }
      if (s.lastOp && s.lastOperand !== null) {
        // Repeated equals re-applies the last operation (Windows calculator behaviour).
        return setResult(s, compute(current(s), s.lastOp, s.lastOperand));
      }
      return { ...s, fresh: true };
    }
    case 'clear':
      return { ...initialCalc(), memory: s.memory };
    case 'clearEntry':
      return { ...s, display: '0', fresh: true };
    case 'backspace': {
      if (s.fresh) return s;
      const d = s.display.slice(0, -1);
      return { ...s, display: d === '' || d === '-' ? '0' : d };
    }
    case 'negate': {
      if (s.display === '0') return s;
      const d = s.display.startsWith('-') ? s.display.slice(1) : '-' + s.display;
      return { ...s, display: d };
    }
    case 'percent': {
      const base = s.acc ?? 0;
      return setResult(s, (base * current(s)) / 100);
    }
    case 'sqrt': {
      const v = current(s);
      if (v < 0) return withError(s, 'Invalid input for function.');
      return setResult(s, Math.sqrt(v));
    }
    case 'reciprocal': {
      const v = current(s);
      if (v === 0) return withError(s, 'Cannot divide by zero.');
      return setResult(s, 1 / v);
    }
    case 'memory': {
      const v = current(s);
      if (input.m === 'MC') return { ...s, memory: 0 };
      if (input.m === 'MS') return { ...s, memory: v, fresh: true };
      if (input.m === 'M+') return { ...s, memory: Number.parseFloat((s.memory + v).toPrecision(12)), fresh: true };
      return { ...s, display: formatNumber(s.memory) ?? '0', fresh: true };
    }
  }
}

/** Map a keyboard key to a calculator input. */
export function keyToInput(key: string): CalcInput | null {
  if (/^[0-9]$/.test(key)) return { type: 'digit', d: key };
  switch (key) {
    case '.': case ',': return { type: 'dot' };
    case '+': return { type: 'op', op: '+' };
    case '-': return { type: 'op', op: '-' };
    case '*': case 'x': case 'X': return { type: 'op', op: '*' };
    case '/': return { type: 'op', op: '/' };
    case 'Enter': case '=': return { type: 'equals' };
    case 'Escape': return { type: 'clear' };
    case 'Delete': return { type: 'clearEntry' };
    case 'Backspace': return { type: 'backspace' };
    case '%': return { type: 'percent' };
    case 'F9': return { type: 'negate' };
    case 'r': case 'R': return { type: 'reciprocal' };
    case '@': return { type: 'sqrt' };
    default: return null;
  }
}
