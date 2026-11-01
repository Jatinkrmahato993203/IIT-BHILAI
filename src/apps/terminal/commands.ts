import type { VfsService } from '../../domain/fs/service';
import { ROOT_ID, type FsNode, type NodeId } from '../../domain/fs/types';
import { validateName } from '../../domain/fs/validation';
import { checkPassword, has, type StoryEvent, type StoryState } from '../../domain/story/engine';
import type { AppId } from '../../shell/appIds';

export const MAX_INPUT = 200;
export const MAX_OUTPUT_LINES = 400;

export type TerminalContext = {
  vfs: VfsService;
  cwd: NodeId;
  story: StoryState;
  verCount: number;
  emit: (e: StoryEvent) => void;
  launch: (appId: AppId, args?: Record<string, string>) => void;
};

export type CommandResult = {
  lines: string[];
  cwd?: NodeId;
  clear?: boolean;
  exit?: boolean;
  verCount?: number;
};

/** Splits on whitespace, honouring "double quoted" names. Never interprets anything else. */
export function tokenize(input: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  let had = false;
  for (const ch of input.slice(0, MAX_INPUT)) {
    if (ch === '"') {
      quoted = !quoted;
      had = true;
      continue;
    }
    if (!quoted && /\s/.test(ch)) {
      if (had || cur) out.push(cur);
      cur = '';
      had = false;
      continue;
    }
    cur += ch;
  }
  if (had || cur) out.push(cur);
  return out;
}

const VER_LINES = [
  'Windows 98 [Version 4.10.1998]  (fan-made, not affiliated with Microsoft)',
  'Still Windows 98. It is always going to be Windows 98 in here.',
  'SYSADMIN-99 Edition. Now with 40% more dread.',
  'Version: Y2K-compliant (self-certified by a 14-year-old).',
  'Version 4.10.1998. Running continuously since 23:58. Very tired.',
  'You have checked the version 6 times. The version is fine. Are YOU fine?',
];

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function dosDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '00-00-00  00:00';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  let h = d.getHours();
  const ap = h >= 12 ? 'p' : 'a';
  h = h % 12 || 12;
  return `${mm}-${dd}-${yy}  ${String(h).padStart(2, ' ')}:${String(d.getMinutes()).padStart(2, '0')}${ap}`;
}

/** Resolve a DOS-style path relative to cwd without ever going above C:\. */
export function resolveRelative(vfs: VfsService, cwd: NodeId, raw: string): { ok: true; id: NodeId } | { ok: false; message: string } {
  let input = raw.trim();
  if (input === '') return { ok: true, id: cwd };
  if (/^[a-z][a-z0-9+.-]+:/i.test(input) && !/^[a-z]:/i.test(input)) return { ok: false, message: 'Invalid drive specification' };
  if (/^[\\/]{2}/.test(input)) return { ok: false, message: 'Network paths are not supported' };
  let current = cwd;
  const drive = /^([a-z]):(.*)$/i.exec(input);
  if (drive) {
    if (drive[1].toUpperCase() !== 'C') return { ok: false, message: 'Invalid drive specification' };
    current = ROOT_ID;
    input = drive[2];
  }
  if (/^[\\/]/.test(input)) current = ROOT_ID;
  const parts = input.split(/[\\/]+/).filter((p) => p.length > 0);
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..' || /^\.{3,}$/.test(part)) {
      const steps = part.length - 1;
      for (let i = 0; i < steps; i++) {
        const n = vfs.getNode(current);
        if (n?.parentId) current = n.parentId; // never above root
      }
      continue;
    }
    const v = validateName(part);
    if (!v.ok) return { ok: false, message: 'Invalid directory' };
    const child = vfs.listChildren(current).find((c) => c.name.toLowerCase() === v.value.toLowerCase());
    if (!child) return { ok: false, message: 'File not found' };
    current = child.id;
  }
  return { ok: true, id: current };
}

const promptPath = (vfs: VfsService, id: NodeId) => vfs.getDisplayPath(id);

function dir(ctx: TerminalContext, arg: string): string[] {
  const r = resolveRelative(ctx.vfs, ctx.cwd, arg);
  if (!r.ok) return [r.message];
  const node = ctx.vfs.getNode(r.id);
  if (!node || node.kind === 'file') return ['File not found'];
  const kids = ctx.vfs.listChildren(r.id);
  const lines = [' Volume in drive C is SYSADMIN-99', ' Volume Serial Number is 1999-1231', ` Directory of ${promptPath(ctx.vfs, r.id)}`, ''];
  let files = 0;
  let dirs = 0;
  let bytes = 0;
  for (const k of kids) {
    if (k.kind === 'file') {
      files++;
      bytes += k.sizeBytes;
      lines.push(`${dosDate(k.updatedAt)}  ${pad(k.sizeBytes.toLocaleString('en-US'), 12).padStart(12)}  ${k.name}`);
    } else {
      dirs++;
      lines.push(`${dosDate(k.updatedAt)}    <DIR>          ${k.name}`);
    }
  }
  lines.push(`        ${files} file(s)   ${bytes.toLocaleString('en-US')} bytes`, `        ${dirs} dir(s)    6,400,000 bytes free (and 0 bytes of courage)`);
  return lines;
}

function findFile(ctx: TerminalContext, arg: string): { ok: true; node: FsNode } | { ok: false; message: string } {
  if (!arg) return { ok: false, message: 'Required parameter missing' };
  const r = resolveRelative(ctx.vfs, ctx.cwd, arg);
  if (!r.ok) return r;
  const node = ctx.vfs.getNode(r.id);
  if (!node) return { ok: false, message: 'File not found' };
  if (node.kind !== 'file') return { ok: false, message: 'Access denied - that is a directory' };
  return { ok: true, node };
}

export const HELP_LINES = [
  'Available commands:',
  '  HELP            Show this list           HELP ME      Ask for help (emotionally)',
  '  DIR [path]      List files               CD [path]    Change directory (CD .. goes up)',
  '  TYPE file       Show a text file         CLS          Clear the screen',
  '  ECHO text       Repeat text              DATE / TIME  Show the system clock',
  '  VER             Show the version         MEM          Show memory',
  '  START app       Open a program (notepad, calc, explorer, iexplore, vault)',
  '  NOTEPAD [file]  Edit a file in Notepad   UNLOCK pass  Unlock the SYSADMIN-99 vault',
  '  EXIT            Close this window',
  'This is a simulation. No command touches your real computer.',
];

const START_TARGETS: Record<string, AppId> = {
  notepad: 'notepad', 'notepad.exe': 'notepad', calc: 'calculator', 'calc.exe': 'calculator',
  explorer: 'explorer', 'explorer.exe': 'explorer', iexplore: 'browser', 'iexplore.exe': 'browser',
  vault: 'vault', sysadmin99: 'vault', 'sysadmin99.exe': 'vault', control: 'control', winhelp: 'help',
};

export function runCommand(rawInput: string, ctx: TerminalContext): CommandResult {
  const input = rawInput.slice(0, MAX_INPUT).trim();
  if (input === '') return { lines: [] };
  const tokens = tokenize(input);
  const cmd = (tokens[0] ?? '').toLowerCase();
  const rest = input.slice(input.toLowerCase().indexOf(cmd) + cmd.length).trim();
  const arg = tokens.slice(1).join(' ');

  // Bare drive switch like "a:" or "d:"
  if (/^[a-z]:$/i.test(cmd)) {
    if (cmd.toLowerCase() === 'c:') return { lines: [], cwd: ROOT_ID };
    return { lines: ['Not ready reading drive ' + cmd.toUpperCase().slice(0, 1), 'Abort, Retry, Fail? F  (the floppy is in a tiffin box)'] };
  }
  if (cmd.startsWith('cd.') || cmd.startsWith('cd\\')) return runCommand('cd ' + cmd.slice(2) + ' ' + arg, ctx);

  switch (cmd) {
    case 'help':
    case '/?':
      if (tokens[1]?.toLowerCase() === 'me') {
        if (has(ctx.story, 'clue.secret-unlocked'))
          return { lines: ['The vault is already open. Try: CD \\TOP_SECRET then DIR.'] };
        if (has(ctx.story, 'clue.letter-read') || has(ctx.story, 'file.opened:y2k-checklist'))
          return { lines: ['SYSADMIN-99: You seem to be looking for the vault.', 'Type UNLOCK followed by the password from the checklist (item 7).'] };
        return { lines: ['SYSADMIN-99: It is going to be OK. Probably.', 'Have you read the files in C:\\My Documents? Start with "Read Me First.txt".'] };
      }
      return { lines: HELP_LINES };
    case 'cls':
      return { lines: [], clear: true };
    case 'echo':
      return { lines: [rest === '' ? 'ECHO is on.' : rest] };
    case 'date':
      return { lines: ['Current date is Fri 12-31-1999', 'Enter new date (mm-dd-yy): [CMOS battery dead - date cannot be changed]'] };
    case 'time':
      return { lines: ['Current time is 11:58:00.00p', 'The clock stopped when the owner shut down. Time is a construct.'] };
    case 'ver': {
      const n = ctx.verCount;
      return { lines: ['', VER_LINES[Math.min(n, VER_LINES.length - 1)], ''], verCount: n + 1 };
    }
    case 'mem':
      return { lines: ['    655,360 bytes total conventional memory', '    640K ought to be enough for anybody (citation needed)', '    1 unsent e-mail occupying 100% of emotional memory'] };
    case 'dir':
      return { lines: dir(ctx, arg) };
    case 'cd':
    case 'chdir': {
      if (!arg) return { lines: [promptPath(ctx.vfs, ctx.cwd)] };
      const r = resolveRelative(ctx.vfs, ctx.cwd, arg);
      if (!r.ok) return { lines: [r.message === 'File not found' ? 'Invalid directory' : r.message] };
      const n = ctx.vfs.getNode(r.id);
      if (!n || n.kind === 'file') return { lines: ['Invalid directory'] };
      return { lines: [], cwd: r.id };
    }
    case 'type': {
      const f = findFile(ctx, arg);
      if (!f.ok) return { lines: [f.message] };
      const t = ctx.vfs.readText(f.node.id);
      if (!t.ok) return { lines: ['Cannot display binary file. It is mostly zeros and regret.'] };
      emitForNode(ctx, f.node.id);
      return { lines: t.value.text.split(/\r?\n/).slice(0, MAX_OUTPUT_LINES) };
    }
    case 'notepad':
    case 'edit': {
      if (!arg) {
        ctx.launch('notepad');
        return { lines: [] };
      }
      const f = findFile(ctx, arg);
      if (!f.ok) return { lines: [f.message] };
      if (f.node.mimeType !== 'text/plain') return { lines: ['Cannot edit binary file'] };
      ctx.launch('notepad', { fileId: f.node.id });
      return { lines: [] };
    }
    case 'start':
    case 'run': {
      const target = START_TARGETS[(tokens[1] ?? '').toLowerCase()];
      if (!target) return { lines: [tokens[1] ? `Cannot find '${tokens[1]}'.` : 'Usage: START notepad | calc | explorer | iexplore | vault'] };
      ctx.launch(target);
      return { lines: [] };
    }
    case 'unlock': {
      if (!arg) return { lines: ['Usage: UNLOCK password'] };
      if (has(ctx.story, 'clue.secret-unlocked')) return { lines: ['The vault is already open. C:\\TOP_SECRET is visible.'] };
      if (!checkPassword(arg)) return { lines: ['ACCESS DENIED. SYSADMIN-99 has noted your attempt in a very stern font.'] };
      ctx.emit('clue.secret-unlocked');
      return { lines: ['ACCESS GRANTED.', 'C:\\TOP_SECRET has been revealed. Type CD \\TOP_SECRET'] };
    }
    case 'exit':
      return { lines: [], exit: true };
    case 'format':
      return { lines: ['WARNING: ALL DATA ON NON-REMOVABLE DISK DRIVE C: WILL BE LOST!', "Just kidding. Aarav's mom disabled this command in 1998."] };
    case 'del':
    case 'erase':
    case 'deltree':
    case 'rd':
    case 'rmdir':
    case 'copy':
    case 'move':
    case 'ren':
    case 'md':
    case 'mkdir':
      return { lines: ['This command has been disabled by SYSADMIN-99 to protect the evidence.', 'Use My Computer to manage files.'] };
    case 'win':
      return { lines: ['You are already in Windows. Look up.'] };
    default:
      return { lines: ['Bad command or file name'] };
  }
}

function emitForNode(ctx: TerminalContext, id: NodeId) {
  const ev = STORY_FILE_EVENTS[id];
  if (ev) ctx.emit(ev);
}

/** Opening these seeded files (from any app) produces a story event. */
export const STORY_FILE_EVENTS: Record<string, StoryEvent> = {
  'seed:readme': 'file.opened:read-me',
  'seed:checklist': 'file.opened:y2k-checklist',
  'seed:unsent': 'clue.letter-read',
  'seed:plan': 'file.opened:survival-plan',
};
