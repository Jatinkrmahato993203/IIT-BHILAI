import { describe, expect, it } from 'vitest';
import { parsePath, validateName, extensionOf } from '../domain/fs/validation';

describe('validateName', () => {
  it.each([
    ['notes.txt', 'notes.txt'],
    ['  spaced name  ', 'spaced name'],
    ['trailing dots...', 'trailing dots'],
    ['Ünïcødé ✓.txt', 'Ünïcødé ✓.txt'],
  ])('accepts %j', (input, expected) => {
    const r = validateName(input);
    expect(r).toEqual({ ok: true, value: expected });
  });

  it.each(['', '   ', '.', '..', 'a/b', 'a\\b', 'C:', 'x*y', 'q?', 'a"b', '<script>', 'pipe|', 'nul\u0000', 'tab\tname', 'CON', 'con.txt', 'LPT1', 'x'.repeat(81)])(
    'rejects %j',
    (input) => {
      const r = validateName(input);
      expect(r.ok).toBe(false);
    },
  );

  it('extension helper', () => {
    expect(extensionOf('a.TXT')).toBe('txt');
    expect(extensionOf('.hidden')).toBe('');
    expect(extensionOf('noext')).toBe('');
  });
});

describe('parsePath (TC-007)', () => {
  it('parses drive roots', () => {
    expect(parsePath('C:')).toEqual({ ok: true, value: [] });
    expect(parsePath('c:\\')).toEqual({ ok: true, value: [] });
    expect(parsePath('C:/My Documents/letters/')).toEqual({ ok: true, value: ['My Documents', 'letters'] });
  });
  it.each([
    'C:\\..\\..\\Windows',
    '../../etc/passwd',
    'C:\\My Documents\\..',
    'C:\\.\\x',
    '\\\\server\\share',
    '//server/share',
    'D:\\',
    'A:',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://evil.example',
    'C:relative',
    'C:\\a\\\\b',
    'C:\\bad|name',
    '',
    'My Documents',
    'C:\\' + 'a\\'.repeat(200),
  ])('rejects %j', (p) => {
    const r = parsePath(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_PATH');
  });
});
