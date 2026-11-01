import { beforeEach, describe, expect, it } from 'vitest';
import { runCommand, tokenize, type TerminalContext } from '../apps/terminal/commands';
import { VfsService } from '../domain/fs/service';
import { ROOT_ID } from '../domain/fs/types';
import { initialStory, type StoryEvent } from '../domain/story/engine';
import { MemoryAdapter } from '../persistence/memoryAdapter';
import { seedIfNeeded } from '../persistence/bootstrap';
import { SEED_IDS } from '../content/seed';
import { resolveAddress } from '../apps/browser/routes';

let ctx: TerminalContext;
let events: StoryEvent[];
let launched: string[];
beforeEach(async () => {
  const adapter = new MemoryAdapter();
  await seedIfNeeded(adapter);
  const snap = await adapter.load();
  const vfs = new VfsService(adapter);
  vfs.hydrate(snap.nodes, snap.contents);
  events = [];
  launched = [];
  ctx = { vfs, cwd: ROOT_ID, story: initialStory(), verCount: 0, emit: (e) => events.push(e), launch: (a) => launched.push(a) };
});

describe('DOS prompt (FR-035, TC-014)', () => {
  it('tokenizes quoted names', () => {
    expect(tokenize('type "Read Me First.txt"')).toEqual(['type', 'Read Me First.txt']);
    expect(tokenize('  dir   ')).toEqual(['dir']);
  });

  it('dir lists virtual files only', () => {
    const r = runCommand('dir', ctx);
    expect(r.lines.join('\n')).toMatch(/My Documents/);
    expect(r.lines.join('\n')).not.toMatch(/TOP_SECRET/);
  });

  it('cd never goes above root and rejects foreign drives/UNC', () => {
    expect(runCommand('cd ..\\..\\..', ctx).cwd).toBe(ROOT_ID);
    expect(runCommand('cd "My Documents"', ctx).cwd).toBe(SEED_IDS.docs);
    expect(runCommand('cd C:\\My Documents\\letters', ctx).cwd).toBe(SEED_IDS.letters);
    expect(runCommand('cd D:\\', ctx).lines[0]).toMatch(/Invalid drive/);
    expect(runCommand('cd \\\\server\\share', ctx).lines[0]).toMatch(/Network/);
    expect(runCommand('cd TOP_SECRET', ctx).lines[0]).toBe('Invalid directory');
    ctx.cwd = SEED_IDS.letters;
    expect(runCommand('cd..', ctx).cwd).toBe(SEED_IDS.docs);
  });

  it('type shows text and emits story events', () => {
    ctx.cwd = SEED_IDS.docs;
    const r = runCommand('type y2k_checklist.txt', ctx);
    expect(r.lines.join('\n')).toMatch(/Y2K EMERGENCY CHECKLIST/);
    expect(events).toEqual(['file.opened:y2k-checklist']);
  });

  it.each(['dir && rm -rf /', 'rm -rf /', '<script>alert(1)</script>', 'javascript:alert(1)', '$(whoami)', '`ls`', 'eval("1")'])('inert: %s', (cmd) => {
    const r = runCommand(cmd, ctx);
    expect(events).toEqual([]);
    expect(launched).toEqual([]);
    expect(r.cwd === undefined || r.cwd === ROOT_ID).toBe(true);
  });

  it('dir && ... is treated as a bad path, not chaining', () => {
    expect(runCommand('dir && rm -rf /', ctx).lines[0]).toBe('File not found');
    expect(runCommand('rm -rf /', ctx).lines[0]).toBe('Bad command or file name');
  });

  it('unlock with the right password emits the same event as the vault', () => {
    expect(runCommand('unlock password', ctx).lines[0]).toMatch(/DENIED/);
    expect(events).toEqual([]);
    expect(runCommand('unlock midnight', ctx).lines[0]).toBe('ACCESS GRANTED.');
    expect(events).toEqual(['clue.secret-unlocked']);
  });

  it('ver cycles through comedy lines', () => {
    const a = runCommand('ver', ctx);
    ctx.verCount = a.verCount!;
    const b = runCommand('ver', ctx);
    expect(a.lines[1]).not.toBe(b.lines[1]);
  });

  it('caps input length', () => {
    expect(() => runCommand('echo ' + 'x'.repeat(10_000), ctx)).not.toThrow();
    expect(runCommand('echo ' + 'x'.repeat(10_000), ctx).lines[0].length).toBeLessThanOrEqual(200);
  });

  it('start launches only allowlisted apps', () => {
    runCommand('start calc', ctx);
    runCommand('start cmd.exe', ctx);
    expect(launched).toEqual(['calculator']);
  });
});

describe('fake browser address resolver (FR-034)', () => {
  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', 'about:blank', 'vbscript:x'])('blocks %s', (a) => {
    expect(resolveAddress(a)).toMatchObject({ kind: 'error', reason: 'blocked' });
  });
  it('resolves registered pages and aliases', () => {
    expect(resolveAddress('retro://mail')).toMatchObject({ kind: 'page', route: 'mail' });
    expect(resolveAddress('http://www.dialup99.example/')).toMatchObject({ kind: 'page', route: 'home' });
    expect(resolveAddress('retro://search?q=y2k%20bug')).toMatchObject({ route: 'search', query: 'y2k bug' });
  });
  it('unknown sites never fetch: offline / not found', () => {
    expect(resolveAddress('https://google.com')).toMatchObject({ kind: 'error', reason: 'offline' });
    expect(resolveAddress('retro://nope')).toMatchObject({ kind: 'error', reason: 'not-found' });
  });
  it('keywords become a local search', () => {
    expect(resolveAddress('millennium bug')).toMatchObject({ kind: 'page', route: 'search', query: 'millennium bug' });
  });
});
