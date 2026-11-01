import { describe, expect, it } from 'vitest';
import { applyEvent, checkPassword, initialStory, nextHint, progressOf, sanitizeStory, stageOf, STORY_EVENTS, type StoryState } from '../domain/story/engine';

const run = (events: Parameters<typeof applyEvent>[1][], s: StoryState = initialStory()) =>
  events.reduce((acc, e) => applyEvent(acc, e).state, s);

describe('story engine', () => {
  it('follows the canonical path to FINISHED', () => {
    const s = run([...STORY_EVENTS]);
    expect(stageOf(s)).toBe('FINISHED');
    expect(progressOf(s)).toBe(5);
  });

  it('ignores duplicate events (idempotent)', () => {
    const s1 = run(['file.opened:read-me', 'file.opened:y2k-checklist']);
    const t = applyEvent(s1, 'file.opened:read-me');
    expect(t.changed).toBe(false);
    expect(t.state).toBe(s1);
  });

  it('accepts clues in any order (no silent dead end)', () => {
    const s = run(['clue.letter-read', 'file.opened:read-me']);
    expect(s.processed).toContain('clue.letter-read');
    expect(stageOf(s)).toBe('LETTER_FOUND');
  });

  it('cannot finish before the secret is unlocked', () => {
    const t = applyEvent(initialStory(), 'file.opened:survival-plan');
    expect(t.changed).toBe(false);
    expect(stageOf(t.state)).toBe('UNSTARTED');
  });

  it('finale is repeatable without regressing progress', () => {
    const s = run([...STORY_EVENTS]);
    const again = applyEvent(s, 'file.opened:survival-plan');
    expect(again.effects).toEqual(['show-finale']);
    expect(again.state.finaleViews).toBe(2);
    expect(stageOf(again.state)).toBe('FINISHED');
  });

  it('unlock produces reveal effect', () => {
    expect(applyEvent(initialStory(), 'clue.secret-unlocked').effects).toEqual(['reveal-secret']);
  });

  it('rejects unknown events', () => {
    // @ts-expect-error testing untrusted input
    expect(applyEvent(initialStory(), 'rm -rf').changed).toBe(false);
  });

  it('sanitizes corrupt persisted state', () => {
    expect(sanitizeStory(null)).toEqual(initialStory());
    expect(sanitizeStory({ processed: ['bogus', 'file.opened:read-me', 'file.opened:read-me'], finaleViews: -3 }).processed).toEqual(['file.opened:read-me']);
    // finale without unlock is impossible and is dropped
    expect(sanitizeStory({ processed: ['file.opened:survival-plan'] }).processed).toEqual([]);
    expect(sanitizeStory({ processed: 'x', finaleViews: NaN }).finaleViews).toBe(0);
  });

  it('password check is forgiving about case/quotes but exact otherwise', () => {
    expect(checkPassword('midnight')).toBe(true);
    expect(checkPassword('  "MIDNIGHT" ')).toBe(true);
    expect(checkPassword('password')).toBe(false);
    expect(checkPassword('MIDNIGHT!')).toBe(false);
    expect(checkPassword('x'.repeat(100))).toBe(false);
  });

  it('hints target the first missing milestone and finally spell it out', () => {
    expect(nextHint(initialStory(), 2).text).toMatch(/Read Me First/);
    const s = run(['file.opened:read-me', 'file.opened:y2k-checklist', 'clue.letter-read']);
    expect(nextHint(s, 2).text).toMatch(/MIDNIGHT/);
    expect(nextHint(s, 0).text).not.toMatch(/MIDNIGHT/);
    expect(nextHint(run([...STORY_EVENTS]), 0).title).toBe('Mystery solved');
  });
});
