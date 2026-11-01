/**
 * Pure story engine. Story progress is a set of idempotent flags derived from semantic events,
 * never from timers, pointer positions, audio or file *contents*.
 *
 * Deliberate deviation from the blueprint's strictly linear state machine: the three discovery
 * clues may be found in any order (a visitor who opens the letter first must not hit a silent
 * no-op dead end). The unlock is gated by the password, and the finale by the unlock (the
 * hidden folder simply cannot be reached before it).
 */
export type StoryEvent =
  | 'file.opened:read-me'
  | 'file.opened:y2k-checklist'
  | 'clue.letter-read'
  | 'clue.secret-unlocked'
  | 'file.opened:survival-plan';

export const STORY_EVENTS: readonly StoryEvent[] = [
  'file.opened:read-me',
  'file.opened:y2k-checklist',
  'clue.letter-read',
  'clue.secret-unlocked',
  'file.opened:survival-plan',
];

export type Stage = 'UNSTARTED' | 'INTRO_FOUND' | 'Y2K_FOUND' | 'LETTER_FOUND' | 'SECRET_UNLOCKED' | 'FINISHED';

export type StoryState = {
  version: 1;
  processed: StoryEvent[];
  /** Number of times the finale has been seen (the reveal is repeatable). */
  finaleViews: number;
};

export const initialStory = (): StoryState => ({ version: 1, processed: [], finaleViews: 0 });

const isStoryEvent = (e: unknown): e is StoryEvent => typeof e === 'string' && (STORY_EVENTS as readonly string[]).includes(e);

export const has = (s: StoryState, e: StoryEvent) => s.processed.includes(e);

export type Transition = { state: StoryState; changed: boolean; effects: StoryEffect[] };
export type StoryEffect = 'reveal-secret' | 'show-finale' | 'clue-found';

export function applyEvent(state: StoryState, event: StoryEvent): Transition {
  if (!isStoryEvent(event)) return { state, changed: false, effects: [] };
  // The finale can only be triggered once the secret is unlocked. Opening the plan again
  // after finishing replays the (repeatable) reveal without changing progress.
  if (event === 'file.opened:survival-plan') {
    if (!has(state, 'clue.secret-unlocked')) return { state, changed: false, effects: [] };
    const first = !has(state, event);
    return {
      state: { ...state, processed: first ? [...state.processed, event] : state.processed, finaleViews: state.finaleViews + 1 },
      changed: true,
      effects: ['show-finale'],
    };
  }
  if (has(state, event)) return { state, changed: false, effects: [] };
  const next: StoryState = { ...state, processed: [...state.processed, event] };
  return { state: next, changed: true, effects: event === 'clue.secret-unlocked' ? ['reveal-secret'] : ['clue-found'] };
}

export function stageOf(s: StoryState): Stage {
  if (has(s, 'file.opened:survival-plan')) return 'FINISHED';
  if (has(s, 'clue.secret-unlocked')) return 'SECRET_UNLOCKED';
  if (has(s, 'clue.letter-read')) return 'LETTER_FOUND';
  if (has(s, 'file.opened:y2k-checklist')) return 'Y2K_FOUND';
  if (has(s, 'file.opened:read-me')) return 'INTRO_FOUND';
  return 'UNSTARTED';
}

/** Number of the 5 milestones completed. */
export const progressOf = (s: StoryState) => STORY_EVENTS.filter((e) => has(s, e)).length;

export const VAULT_PASSWORD = 'MIDNIGHT';

/** Accepts the password case-insensitively, ignoring surrounding whitespace/quotes. */
export function checkPassword(input: string): boolean {
  if (typeof input !== 'string' || input.length > 64) return false;
  const v = input.trim().replace(/^["']|["']$/g, '').trim().toUpperCase();
  return v === VAULT_PASSWORD;
}

/** Validate untrusted persisted data; anything unexpected resets to a clean state. */
export function sanitizeStory(raw: unknown): StoryState {
  if (!raw || typeof raw !== 'object') return initialStory();
  const r = raw as Partial<StoryState>;
  const processed = Array.isArray(r.processed) ? [...new Set(r.processed.filter(isStoryEvent))] : [];
  // Re-validate prerequisites: a finale without an unlock is impossible.
  const clean = processed.filter((e) => e !== 'file.opened:survival-plan' || processed.includes('clue.secret-unlocked'));
  const views = typeof r.finaleViews === 'number' && Number.isFinite(r.finaleViews) && r.finaleViews >= 0 ? Math.floor(r.finaleViews) : 0;
  return { version: 1, processed: clean, finaleViews: clean.includes('file.opened:survival-plan') ? Math.max(1, views) : 0 };
}

export type Hint = { title: string; text: string };

/** Progressive, non-spoiling hints for the next missing milestone. `level` 0..2 */
export function nextHint(s: StoryState, level: number): Hint {
  const lv = Math.max(0, Math.min(2, level));
  const missing = STORY_EVENTS.find((e) => !has(s, e));
  const table: Record<StoryEvent, [string, string, string]> = {
    'file.opened:read-me': [
      'The previous owner left a note on the desktop.',
      'Open "Read Me First" on the desktop (select it and press Enter, or double-click).',
      'Open C:\\My Documents\\Read Me First.txt.',
    ],
    'file.opened:y2k-checklist': [
      'The Read Me asks you very politely not to open a certain checklist.',
      'Look inside My Documents for something about Y2K.',
      'Open C:\\My Documents\\y2k_checklist.txt.',
    ],
    'clue.letter-read': [
      'Some letters are never sent.',
      'There is a "letters" folder in My Documents. Or check the old mailbox on The Internet.',
      'Open C:\\My Documents\\letters\\unsent_1999.txt (or retro://mail in The Internet).',
    ],
    'clue.secret-unlocked': [
      'The letter mentions a vault. Item 7 of the checklist mentions a password.',
      'Open SYSADMIN-99 Vault from the Start menu (Programs). The password is the exact moment the world ends, in one word.',
      'In SYSADMIN-99 Vault, enter the password MIDNIGHT. (In MS-DOS Prompt: unlock MIDNIGHT)',
    ],
    'file.opened:survival-plan': [
      'A new folder appeared on drive C:.',
      'Open My Computer and look at C:\\TOP_SECRET.',
      'Open C:\\TOP_SECRET\\survival_plan.txt.',
    ],
  };
  if (!missing) return { title: 'Mystery solved', text: 'You found everything. Try the Recycle Bin, MS-DOS Prompt (type ver a few times) and The Internet for more secrets.' };
  return { title: `Hint ${lv + 1} of 3`, text: table[missing][lv] };
}
