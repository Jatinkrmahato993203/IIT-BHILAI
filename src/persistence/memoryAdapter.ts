import type { FsNode, NodeId, TextContent } from '../domain/fs/types';
import { StorageFailure, type FsCommit, type Snapshot, type StorageAdapter } from './adapter';

/** Session-only adapter used for tests and when IndexedDB is unavailable. */
export class MemoryAdapter implements StorageAdapter {
  readonly kind = 'memory' as const;
  private nodes = new Map<NodeId, FsNode>();
  private contents = new Map<NodeId, TextContent>();
  private records: { story: unknown; settings: unknown } = { story: null, settings: null };
  private seedVersion: number | null = null;
  /** Test hook: make the next commit fail with the given code. */
  failNext: 'QUOTA' | 'STORAGE' | null = null;

  async load(): Promise<Snapshot> {
    return {
      nodes: [...this.nodes.values()].map((n) => ({ ...n })),
      contents: [...this.contents.values()].map((c) => ({ ...c })),
      story: structuredClone(this.records.story),
      settings: structuredClone(this.records.settings),
      seedVersion: this.seedVersion,
    };
  }

  async commitFs(c: FsCommit): Promise<void> {
    if (this.failNext) {
      const code = this.failNext;
      this.failNext = null;
      throw new StorageFailure(code, code === 'QUOTA' ? 'Disk full' : 'Write failed');
    }
    for (const e of c.expect ?? []) {
      const cur = this.nodes.get(e.id);
      if (!cur || cur.revision !== e.revision)
        throw new StorageFailure('CONFLICT', 'The file was changed by another window.');
    }
    for (const id of c.deleteIds ?? []) {
      this.nodes.delete(id);
      this.contents.delete(id);
    }
    for (const n of c.putNodes ?? []) this.nodes.set(n.id, { ...n });
    for (const t of c.putContents ?? []) this.contents.set(t.nodeId, { ...t });
    if (c.seedVersion !== undefined) this.seedVersion = c.seedVersion;
  }

  async readNodes(ids: NodeId[]) {
    const nodes: FsNode[] = [];
    const contents: TextContent[] = [];
    for (const id of ids) {
      const n = this.nodes.get(id);
      if (n) nodes.push({ ...n });
      const t = this.contents.get(id);
      if (t) contents.push({ ...t });
    }
    return { nodes, contents };
  }

  async saveRecord(store: 'story' | 'settings', value: unknown) {
    this.records[store] = structuredClone(value);
  }

  async clear(scope: 'filesystem' | 'story' | 'settings') {
    if (scope === 'filesystem') {
      this.nodes.clear();
      this.contents.clear();
      this.seedVersion = null;
    } else this.records[scope] = null;
  }
}
