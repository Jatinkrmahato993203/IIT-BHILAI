import { describe, expect, it } from 'vitest';
import { calcReducer, initialCalc, keyToInput, type CalcInput } from '../apps/calculator/logic';

const press = (keys: string) =>
  [...keys].reduce((s, k) => {
    const i = keyToInput(k === '=' ? 'Enter' : k);
    return i ? calcReducer(s, i) : s;
  }, initialCalc());
const seq = (...inputs: CalcInput[]) => inputs.reduce(calcReducer, initialCalc());

describe('calculator (FR-033)', () => {
  it.each([
    ['2+3=', '5'],
    ['0.1+0.2=', '0.3'],
    ['10/4=', '2.5'],
    ['2*3+4=', '10'],
    ['1999+1=', '2000'],
    ['007=', '7'],
    ['1.2.3=', '1.23'],
    ['5-8=', '-3'],
    ['2+==', '6'],
    ['1/3=', '0.333333333333'],
  ])('%s -> %s', (keys, expected) => {
    expect(press(keys).display).toBe(expected);
  });

  it('divide by zero shows an error and recovers on digit', () => {
    const s = press('5/0=');
    expect(s.error).toBe('Cannot divide by zero.');
    expect(calcReducer(s, { type: 'op', op: '+' })).toBe(s);
    expect(calcReducer(s, { type: 'digit', d: '4' }).display).toBe('4');
  });

  it('negate, backspace, sqrt of negative, reciprocal of zero', () => {
    expect(seq({ type: 'digit', d: '9' }, { type: 'negate' }).display).toBe('-9');
    expect(seq({ type: 'digit', d: '9' }, { type: 'digit', d: '8' }, { type: 'backspace' }).display).toBe('9');
    expect(seq({ type: 'digit', d: '9' }, { type: 'negate' }, { type: 'sqrt' }).error).toBeTruthy();
    expect(seq({ type: 'reciprocal' }).error).toBeTruthy();
    expect(seq({ type: 'digit', d: '9' }, { type: 'sqrt' }).display).toBe('3');
  });

  it('caps digits and handles huge values', () => {
    expect(press('12345678901234567890').display.length).toBeLessThanOrEqual(16);
    const big = press('9999999999999999*9999999999999999=');
    expect(big.display).toMatch(/e\+/);
  });

  it('memory functions', () => {
    let s = press('42');
    s = calcReducer(s, { type: 'memory', m: 'MS' });
    s = calcReducer(s, { type: 'clear' });
    s = calcReducer(s, { type: 'memory', m: 'MR' });
    expect(s.display).toBe('42');
  });

  it('ignores unknown keys', () => {
    expect(keyToInput('a')).toBeNull();
    expect(keyToInput(';alert(1)')).toBeNull();
  });
});
