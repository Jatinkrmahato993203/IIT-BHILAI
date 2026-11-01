import type { FsNode, NodeId, TextContent } from '../domain/fs/types';

export type FsCommit = {
  putNodes?: FsNode[];
  putContents?: TextContent[];
  deleteIds?: NodeId[];
  /** Optimistic concurrency: each node must currently have this revision inside the transaction. */
  expect?: { id: NodeId; revision: number }[];
  seedVersion?: number;
};

export type Snapshot = {
  nodes: FsNode[];
  contents: TextContent[];
  story: unknown;
  settings: unknown;
  seedVersion: number | null;
};

export class StorageFailure extends Error {
  readonly code: 'QUOTA' | 'CONFLICT' | 'STORAGE';
  constructor(code: 'QUOTA' | 'CONFLICT' | 'STORAGE', message: string) {
    super(message);
    this.code = code;
  }
}

export interface StorageAdapter {
  readonly kind: 'indexeddb' | 'memory';
  load(): Promise<Snapshot>;
  commitFs(commit: FsCommit): Promise<void>;
  readNodes(ids: NodeId[]): Promise<{ nodes: FsNode[]; contents: TextContent[] }>;
  saveRecord(store: 'story' | 'settings', value: unknown): Promise<void>;
  clear(scope: 'filesystem' | 'story' | 'settings'): Promise<void>;
}

export function toStorageFailure(e: unknown): StorageFailure {
  if (e instanceof StorageFailure) return e;
  const name = (e as { name?: string } | null)?.name ?? '';
  if (name === 'QuotaExceededError')
    return new StorageFailure('QUOTA', 'There is not enough disk space (browser storage is full).');
  return new StorageFailure('STORAGE', 'The disk could not be written to.');
}
