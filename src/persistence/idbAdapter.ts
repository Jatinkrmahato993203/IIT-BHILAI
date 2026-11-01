import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FsNode, NodeId, TextContent } from '../domain/fs/types';
import { StorageFailure, toStorageFailure, type FsCommit, type Snapshot, type StorageAdapter } from './adapter';

export const DB_NAME = 'last-login';
export const DB_VERSION = 1;

interface LastLoginDB extends DBSchema {
  nodes: { key: string; value: FsNode; indexes: { parentId: string } };
  contents: { key: string; value: TextContent };
  story: { key: string; value: { key: string; value: unknown } };
  settings: { key: string; value: { key: string; value: unknown } };
  meta: { key: string; value: { key: string; value: unknown } };
}

export class IdbAdapter implements StorageAdapter {
  readonly kind = 'indexeddb' as const;
  private readonly db: IDBPDatabase<LastLoginDB>;
  private constructor(db: IDBPDatabase<LastLoginDB>) {
    this.db = db;
  }

  /** Opens the database, failing (rather than hanging) after `timeoutMs`. */
  static async open(timeoutMs = 4000): Promise<IdbAdapter> {
    if (typeof indexedDB === 'undefined' || indexedDB === null) throw new StorageFailure('STORAGE', 'IndexedDB unavailable');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new StorageFailure('STORAGE', 'IndexedDB open timed out')), timeoutMs);
    });
    try {
      const db = await Promise.race([
        openDB<LastLoginDB>(DB_NAME, DB_VERSION, {
          upgrade(database, oldVersion) {
            // v0 -> v1: initial schema. Future migrations append `if (oldVersion < N)` blocks
            // and must preserve user content.
            if (oldVersion < 1) {
              const nodes = database.createObjectStore('nodes', { keyPath: 'id' });
              nodes.createIndex('parentId', 'parentId');
              database.createObjectStore('contents', { keyPath: 'nodeId' });
              database.createObjectStore('story', { keyPath: 'key' });
              database.createObjectStore('settings', { keyPath: 'key' });
              database.createObjectStore('meta', { keyPath: 'key' });
            }
          },
          blocked() {
            /* another tab holds an old version; we simply wait or time out */
          },
        }),
        timeout,
      ]);
      return new IdbAdapter(db);
    } catch (e) {
      throw toStorageFailure(e);
    } finally {
      clearTimeout(timer);
    }
  }

  async load(): Promise<Snapshot> {
    try {
      const tx = this.db.transaction(['nodes', 'contents', 'story', 'settings', 'meta'], 'readonly');
      const [nodes, contents, story, settings, seed] = await Promise.all([
        tx.objectStore('nodes').getAll(),
        tx.objectStore('contents').getAll(),
        tx.objectStore('story').get('state'),
        tx.objectStore('settings').get('prefs'),
        tx.objectStore('meta').get('seedVersion'),
      ]);
      await tx.done;
      return {
        nodes,
        contents,
        story: story?.value ?? null,
        settings: settings?.value ?? null,
        seedVersion: typeof seed?.value === 'number' ? seed.value : null,
      };
    } catch (e) {
      throw toStorageFailure(e);
    }
  }

  async commitFs(c: FsCommit): Promise<void> {
    const tx = this.db.transaction(['nodes', 'contents', 'meta'], 'readwrite');
    const nodes = tx.objectStore('nodes');
    const contents = tx.objectStore('contents');
    try {
      for (const e of c.expect ?? []) {
        const cur = await nodes.get(e.id);
        if (!cur || cur.revision !== e.revision) {
          tx.abort();
          throw new StorageFailure('CONFLICT', 'The file was changed in another window or tab.');
        }
      }
      for (const id of c.deleteIds ?? []) {
        await nodes.delete(id);
        await contents.delete(id);
      }
      for (const n of c.putNodes ?? []) await nodes.put(n);
      for (const t of c.putContents ?? []) await contents.put(t);
      if (c.seedVersion !== undefined) await tx.objectStore('meta').put({ key: 'seedVersion', value: c.seedVersion });
      await tx.done;
    } catch (e) {
      // Ensure the aborted transaction promise rejection is observed.
      tx.done.catch(() => undefined);
      throw toStorageFailure(e);
    }
  }

  async readNodes(ids: NodeId[]) {
    const tx = this.db.transaction(['nodes', 'contents'], 'readonly');
    const nodes: FsNode[] = [];
    const contents: TextContent[] = [];
    for (const id of ids) {
      const n = await tx.objectStore('nodes').get(id);
      if (n) nodes.push(n);
      const t = await tx.objectStore('contents').get(id);
      if (t) contents.push(t);
    }
    await tx.done;
    return { nodes, contents };
  }

  async saveRecord(store: 'story' | 'settings', value: unknown) {
    try {
      await this.db.put(store, { key: store === 'story' ? 'state' : 'prefs', value });
    } catch (e) {
      throw toStorageFailure(e);
    }
  }

  async clear(scope: 'filesystem' | 'story' | 'settings') {
    try {
      if (scope === 'filesystem') {
        const tx = this.db.transaction(['nodes', 'contents', 'meta'], 'readwrite');
        await Promise.all([tx.objectStore('nodes').clear(), tx.objectStore('contents').clear(), tx.objectStore('meta').delete('seedVersion')]);
        await tx.done;
      } else await this.db.clear(scope);
    } catch (e) {
      throw toStorageFailure(e);
    }
  }
}
