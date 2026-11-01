import { err, ok, type Result } from '../result';
import { LIMITS } from './types';

// Windows-reserved characters plus ASCII control characters.
// oxlint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[\u0000-\u001f\u007f\\/:*?"<>|]/;
const RESERVED_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Normalises and validates a single file/folder name.
 * Trailing spaces and dots are trimmed (Windows semantics), leading spaces trimmed.
 */
export function validateName(raw: string): Result<string> {
  if (typeof raw !== 'string') return err('INVALID_NAME', 'Name must be text.');
  const name = raw.replace(/^\s+/, '').replace(/[\s.]+$/, '');
  if (name.length === 0) return err('INVALID_NAME', 'A file name cannot be empty.');
  if (name === '.' || name === '..') return err('INVALID_NAME', 'That name is reserved.');
  if ([...name].length > LIMITS.nameMaxLength)
    return err('INVALID_NAME', `Names can be at most ${LIMITS.nameMaxLength} characters.`);
  if (FORBIDDEN_CHARS.test(name))
    return err('INVALID_NAME', 'A file name cannot contain any of the following characters: \\ / : * ? " < > |');
  if (RESERVED_DEVICE.test(name)) return err('INVALID_NAME', `"${name}" is a reserved device name.`);
  return ok(name);
}

export const sameName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0 || a.toLowerCase() === b.toLowerCase();

/**
 * Parses a display path such as `C:\My Documents\letters` into validated segments.
 * Accepts `C:`, `C:\`, forward slashes as separators (normalised), and is case-insensitive
 * on the drive letter. Rejects UNC paths, other drives, URL schemes, `.`/`..`, empty
 * segments in the middle and anything over the path length limit.
 */
export function parsePath(raw: string): Result<string[]> {
  if (typeof raw !== 'string') return err('INVALID_PATH', 'Path must be text.');
  const input = raw.trim();
  if (input.length === 0) return err('INVALID_PATH', 'Path is empty.');
  if (input.length > LIMITS.pathMaxLength) return err('INVALID_PATH', 'Path is too long.');
  if (/^[\\/]{2}/.test(input)) return err('INVALID_PATH', 'Network paths are not available on this computer.');
  if (/^[a-z][a-z0-9+.-]+:/i.test(input)) return err('INVALID_PATH', 'That is not a valid drive.');
  const drive = /^([a-z]):(.*)$/i.exec(input);
  if (!drive) return err('INVALID_PATH', 'Paths must start with a drive letter, e.g. C:\\');
  if (drive[1].toUpperCase() !== 'C') return err('INVALID_PATH', `Drive ${drive[1].toUpperCase()}: is not accessible. The device is not ready.`);
  let rest = drive[2].replace(/\//g, '\\');
  if (rest.length > 0 && !rest.startsWith('\\')) return err('INVALID_PATH', 'Relative drive paths are not supported.');
  rest = rest.replace(/^\\/, '').replace(/\\$/, '');
  if (rest.length === 0) return ok([]);
  const parts = rest.split('\\');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '') return err('INVALID_PATH', 'Path contains an empty folder name.');
    if (part === '.' || part === '..') return err('INVALID_PATH', 'Relative segments (. and ..) are not allowed.');
    const v = validateName(part);
    if (!v.ok) return err('INVALID_PATH', v.error.message);
    out.push(v.value);
  }
  if (out.length > LIMITS.maxDepth) return err('INVALID_PATH', 'Path is nested too deeply.');
  return ok(out);
}

export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}
