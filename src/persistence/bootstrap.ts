import { buildSeed, SEED_VERSION } from '../content/seed';
import { VfsService } from '../domain/fs/service';
import { sanitizeSettings, type Settings } from '../domain/settings';
import { sanitizeStory, type StoryState } from '../domain/story/engine';
import type { StorageAdapter } from './adapter';
import { IdbAdapter } from './idbAdapter';
import { MemoryAdapter } from './memoryAdapter';

export type Boot = {
  adapter: StorageAdapter;
  vfs: VfsService;
  story: StoryState;
  settings: Settings;
  /** Non-null when progress will not survive a reload. */
  storageWarning: string | null;
};

/**
 * Seeds once on first visit, additively upgrades seed content on version bumps, and never
 * overwrites existing (possibly user-modified) nodes.
 */
export async function seedIfNeeded(adapter: StorageAdapter): Promise<void> {
  const snap = await adapter.load();
  if (snap.seedVersion !== null && snap.seedVersion >= SEED_VERSION) return;
  const seed = buildSeed();
  const existing = new Set(snap.nodes.map((n) => n.id));
  const putNodes = seed.nodes.filter((n) => !existing.has(n.id));
  const ids = new Set(putNodes.map((n) => n.id));
  const putContents = seed.contents.filter((c) => ids.has(c.nodeId));
  await adapter.commitFs({ putNodes, putContents, seedVersion: SEED_VERSION });
}

async function loadInto(adapter: StorageAdapter): Promise<Omit<Boot, 'storageWarning'>> {
  await seedIfNeeded(adapter);
  const snap = await adapter.load();
  const vfs = new VfsService(adapter);
  vfs.hydrate(snap.nodes, snap.contents);
  return { adapter, vfs, story: sanitizeStory(snap.story), settings: sanitizeSettings(snap.settings) };
}

export async function bootstrap(opts: { forceMemory?: boolean } = {}): Promise<Boot> {
  if (!opts.forceMemory) {
    try {
      const idb = await IdbAdapter.open();
      return { ...(await loadInto(idb)), storageWarning: null };
    } catch {
      /* fall through to session-only mode */
    }
  }
  const mem = new MemoryAdapter();
  return {
    ...(await loadInto(mem)),
    storageWarning:
      'This browser is not letting the site save data (private mode, blocked storage or a full disk). You can keep exploring, but files and progress will be lost when you close or reload this tab.',
  };
}
