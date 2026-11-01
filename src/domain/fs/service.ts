import { err, ok, type Result } from '../result';
import { LIMITS, ROOT_ID, type FsNode, type NodeId, type TextContent } from './types';
import { parsePath, sameName, utf8Bytes, validateName } from './validation';
import { StorageFailure, type FsCommit, type StorageAdapter } from '../../persistence/adapter';

export type NewId = () => string;
export type Clock = () => string;

const defaultId: NewId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `u:${crypto.randomUUID()}`
    : `u:${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
const defaultClock: Clock = () => new Date().toISOString();

/**
 * Virtual filesystem over an in-memory cache, persisted through a StorageAdapter.
 * Reads are synchronous from the cache. Every mutation is validated, committed to the adapter
 * in one atomic transaction, and only then applied to the cache and announced to listeners.
 */
export class VfsService {
  private nodes = new Map<NodeId, FsNode>();
  private contents = new Map<NodeId, string>();
  private listeners = new Set<() => void>();
  private revealed = new Set<NodeId>();
  private _version = 0;
  private readonly adapter: StorageAdapter;
  private readonly newId: NewId;
  private readonly now: Clock;
  /** Called after every successful commit with the affected ids (used for cross-tab sync). */
  onCommitted: ((ids: NodeId[]) => void) | null = null;

  constructor(adapter: StorageAdapter, opts: { newId?: NewId; now?: Clock } = {}) {
    this.adapter = adapter;
    this.newId = opts.newId ?? defaultId;
    this.now = opts.now ?? defaultClock;
  }

  get storageKind() {
    return this.adapter.kind;
  }
  get version() {
    return this._version;
  }

  /** Load the cache from a snapshot (no I/O). */
  hydrate(nodes: FsNode[], contents: TextContent[]) {
    this.nodes = new Map(nodes.map((n) => [n.id, { ...n }]));
    this.contents = new Map(contents.map((c) => [c.nodeId, c.content]));
    this.bump();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getVersion = () => this._version;

  private bump() {
    this._version++;
    for (const l of [...this.listeners]) l();
  }

  /** Hidden nodes stay invisible unless revealed (controlled by story progress). */
  setRevealed(ids: Iterable<NodeId>) {
    const next = new Set(ids);
    if (next.size === this.revealed.size && [...next].every((i) => this.revealed.has(i))) return;
    this.revealed = next;
    this.bump();
  }

  // ---------- queries ----------

  getNode(id: NodeId): FsNode | undefined {
    return this.nodes.get(id);
  }

  /** True when the node and every ancestor exist, are not deleted, and are visible. */
  isAccessible(id: NodeId, opts: { allowDeleted?: boolean } = {}): boolean {
    let cur = this.nodes.get(id);
    let guard = 0;
    while (cur) {
      if (!opts.allowDeleted && cur.deletedAt) return false;
      if (cur.hidden && !this.revealed.has(cur.id)) return false;
      if (cur.parentId === null) return cur.id === ROOT_ID;
      cur = this.nodes.get(cur.parentId);
      if (++guard > LIMITS.maxDepth + 4) return false; // cycle guard
    }
    return false;
  }

  isVisible(node: FsNode) {
    return !node.deletedAt && (!node.hidden || this.revealed.has(node.id));
  }

  listChildren(folderId: NodeId): FsNode[] {
    const out: FsNode[] = [];
    for (const n of this.nodes.values()) if (n.parentId === folderId && this.isVisible(n)) out.push(n);
    return out.sort(compareNodes);
  }

  listDeleted(): FsNode[] {
    return [...this.nodes.values()]
      .filter((n) => n.deletedAt)
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
  }

  getDisplayPath(id: NodeId): string {
    const parts: string[] = [];
    let cur = this.nodes.get(id);
    let guard = 0;
    while (cur && cur.parentId !== null && guard++ < 64) {
      parts.unshift(cur.name);
      cur = this.nodes.get(cur.parentId);
    }
    return 'C:\\' + parts.join('\\');
  }

  /** Resolve a display path to a node id. Hidden (unrevealed) and deleted nodes are not found. */
  resolvePath(path: string): Result<NodeId> {
    const parsed = parsePath(path);
    if (!parsed.ok) return parsed;
    let current = ROOT_ID;
    for (let i = 0; i < parsed.value.length; i++) {
      const seg = parsed.value[i];
      const child = this.listChildren(current).find((c) => sameName(c.name, seg));
      if (!child) return err('NOT_FOUND', `Cannot find '${this.getDisplayPath(current).replace(/\\$/, '')}\\${seg}'. Make sure the path is correct.`);
      if (i < parsed.value.length - 1 && child.kind === 'file')
        return err('INVALID_PATH', `'${child.name}' is not a folder.`);
      current = child.id;
    }
    return ok(current);
  }

  readText(id: NodeId): Result<{ text: string; revision: number; node: FsNode }> {
    const node = this.nodes.get(id);
    if (!node || !this.isAccessible(id, { allowDeleted: false })) return err('NOT_FOUND', 'The file could not be found. It may have been moved or deleted.');
    if (node.kind !== 'file') return err('UNSUPPORTED', 'That is a folder, not a file.');
    if (node.mimeType !== 'text/plain') return err('UNSUPPORTED', 'This file is not a text document.');
    return ok({ text: this.contents.get(id) ?? '', revision: node.revision, node });
  }

  /** Read a deleted file's text for preview from the Recycle Bin. */
  peekText(id: NodeId): string | undefined {
    return this.contents.get(id);
  }

  private depthOf(id: NodeId): number {
    let d = 0;
    let cur = this.nodes.get(id);
    while (cur && cur.parentId !== null && d < 64) {
      d++;
      cur = this.nodes.get(cur.parentId);
    }
    return d;
  }

  private findSibling(parentId: NodeId, name: string, exceptId?: NodeId): FsNode | undefined {
    // Hidden siblings still count for collisions (they exist on disk), deleted ones do not.
    for (const n of this.nodes.values())
      if (n.parentId === parentId && !n.deletedAt && n.id !== exceptId && sameName(n.name, name)) return n;
    return undefined;
  }

  private checkFolderTarget(parentId: NodeId): Result<FsNode> {
    const parent = this.nodes.get(parentId);
    if (!parent || !this.isAccessible(parentId)) return err('NOT_FOUND', 'The destination folder does not exist.');
    if (parent.kind === 'file') return err('INVALID_PATH', 'The destination is not a folder.');
    if (parent.readOnly) return err('READ_ONLY', `'${parent.kind === 'drive' ? 'C:\\' : parent.name}' is read-only. You cannot add files here.`);
    return ok(parent);
  }

  /** Returns a non-colliding name such as `notes (2).txt`. */
  uniqueName(parentId: NodeId, name: string): string {
    if (!this.findSibling(parentId, name)) return name;
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let i = 2; i < 1000; i++) {
      const candidate = `${base} (${i})${ext}`;
      if (!this.findSibling(parentId, candidate)) return candidate;
    }
    return `${base} (${Date.now()})${ext}`;
  }

  // ---------- mutations ----------

  private async commit(c: FsCommit, affected: NodeId[]): Promise<Result<void>> {
    try {
      await this.adapter.commitFs(c);
    } catch (e) {
      const f = e instanceof StorageFailure ? e : new StorageFailure('STORAGE', 'The disk could not be written to.');
      return err(f.code, f.message);
    }
    for (const id of c.deleteIds ?? []) {
      this.nodes.delete(id);
      this.contents.delete(id);
    }
    for (const n of c.putNodes ?? []) this.nodes.set(n.id, { ...n });
    for (const t of c.putContents ?? []) this.contents.set(t.nodeId, t.content);
    this.bump();
    this.onCommitted?.(affected);
    return ok(undefined);
  }

  private checkText(text: string): Result<number> {
    if (typeof text !== 'string') return err('UNSUPPORTED', 'Only text can be saved.');
    const size = utf8Bytes(text);
    if (size > LIMITS.textMaxBytes)
      return err('TOO_LARGE', `This file is too large for Notepad (limit ${LIMITS.textMaxBytes / 1024} KB).`);
    return ok(size);
  }

  private checkCapacity(adding: number): Result<void> {
    if (this.nodes.size + adding > LIMITS.maxNodes) return err('QUOTA', 'The disk is full. Delete some files and try again.');
    return ok(undefined);
  }

  async createText(parentId: NodeId, rawName: string, text: string): Promise<Result<FsNode>> {
    const name = validateName(rawName);
    if (!name.ok) return name;
    const parent = this.checkFolderTarget(parentId);
    if (!parent.ok) return parent;
    if (this.depthOf(parentId) + 1 > LIMITS.maxDepth) return err('INVALID_PATH', 'Folders are nested too deeply.');
    if (this.findSibling(parentId, name.value)) return err('DUPLICATE', `A file or folder named '${name.value}' already exists.`);
    const size = this.checkText(text);
    if (!size.ok) return size;
    const cap = this.checkCapacity(1);
    if (!cap.ok) return cap;
    const t = this.now();
    const node: FsNode = {
      id: this.newId(), parentId, name: name.value, kind: 'file', mimeType: 'text/plain',
      sizeBytes: size.value, createdAt: t, updatedAt: t, revision: 1,
    };
    const r = await this.commit({ putNodes: [node], putContents: [{ nodeId: node.id, content: text }] }, [node.id]);
    return r.ok ? ok(node) : r;
  }

  async createFolder(parentId: NodeId, rawName: string): Promise<Result<FsNode>> {
    const name = validateName(rawName);
    if (!name.ok) return name;
    const parent = this.checkFolderTarget(parentId);
    if (!parent.ok) return parent;
    if (this.depthOf(parentId) + 1 > LIMITS.maxDepth) return err('INVALID_PATH', 'Folders are nested too deeply.');
    if (this.findSibling(parentId, name.value)) return err('DUPLICATE', `A file or folder named '${name.value}' already exists.`);
    const cap = this.checkCapacity(1);
    if (!cap.ok) return cap;
    const t = this.now();
    const node: FsNode = { id: this.newId(), parentId, name: name.value, kind: 'folder', sizeBytes: 0, createdAt: t, updatedAt: t, revision: 1 };
    const r = await this.commit({ putNodes: [node] }, [node.id]);
    return r.ok ? ok(node) : r;
  }

  async writeText(id: NodeId, text: string, expectedRevision: number): Promise<Result<FsNode>> {
    const node = this.nodes.get(id);
    if (!node || !this.isAccessible(id)) return err('NOT_FOUND', 'The file no longer exists. Use Save As to save a new copy.');
    if (node.kind !== 'file' || node.mimeType !== 'text/plain') return err('UNSUPPORTED', 'Only text files can be saved.');
    if (node.readOnly) return err('READ_ONLY', `'${node.name}' is read-only. Use Save As to save a copy.`);
    if (node.revision !== expectedRevision) return err('CONFLICT', `'${node.name}' was changed in another window.`);
    const size = this.checkText(text);
    if (!size.ok) return size;
    const updated: FsNode = { ...node, sizeBytes: size.value, revision: node.revision + 1, updatedAt: this.now() };
    const r = await this.commit(
      { putNodes: [updated], putContents: [{ nodeId: id, content: text }], expect: [{ id, revision: expectedRevision }] },
      [id],
    );
    return r.ok ? ok(updated) : r;
  }

  private guardMutable(node: FsNode | undefined, verb: string): Result<FsNode> {
    if (!node || !this.isAccessible(node.id)) return err('NOT_FOUND', 'The item could not be found.');
    if (node.parentId === null) return err('READ_ONLY', `You cannot ${verb} the drive.`);
    if (node.system) return err('READ_ONLY', `'${node.name}' is a system folder and cannot be ${verb === 'move' ? 'moved' : verb + 'd'}.`);
    if (node.readOnly) return err('READ_ONLY', `'${node.name}' is read-only.`);
    const parent = node.parentId ? this.nodes.get(node.parentId) : undefined;
    if (parent?.readOnly) return err('READ_ONLY', `The folder '${parent.name}' is read-only.`);
    return ok(node);
  }

  async rename(id: NodeId, rawName: string): Promise<Result<FsNode>> {
    const g = this.guardMutable(this.nodes.get(id), 'rename');
    if (!g.ok) return g;
    const name = validateName(rawName);
    if (!name.ok) return name;
    const node = g.value;
    if (node.name === name.value) return ok(node);
    if (this.findSibling(node.parentId!, name.value, id)) return err('DUPLICATE', `A file or folder named '${name.value}' already exists.`);
    const updated = { ...node, name: name.value, revision: node.revision + 1, updatedAt: this.now() };
    const r = await this.commit({ putNodes: [updated], expect: [{ id, revision: node.revision }] }, [id]);
    return r.ok ? ok(updated) : r;
  }

  isDescendantOrSelf(candidate: NodeId, ancestor: NodeId): boolean {
    let cur: FsNode | undefined = this.nodes.get(candidate);
    let guard = 0;
    while (cur && guard++ < 64) {
      if (cur.id === ancestor) return true;
      cur = cur.parentId ? this.nodes.get(cur.parentId) : undefined;
    }
    return false;
  }

  async move(id: NodeId, targetFolderId: NodeId): Promise<Result<FsNode>> {
    const g = this.guardMutable(this.nodes.get(id), 'move');
    if (!g.ok) return g;
    const target = this.checkFolderTarget(targetFolderId);
    if (!target.ok) return target;
    const node = g.value;
    if (node.parentId === targetFolderId) return ok(node);
    if (this.isDescendantOrSelf(targetFolderId, id)) return err('INVALID_PATH', 'The destination folder is inside the folder being moved.');
    if (this.findSibling(targetFolderId, node.name, id)) return err('DUPLICATE', `The destination already contains '${node.name}'.`);
    const updated = { ...node, parentId: targetFolderId, revision: node.revision + 1, updatedAt: this.now() };
    const r = await this.commit({ putNodes: [updated], expect: [{ id, revision: node.revision }] }, [id]);
    return r.ok ? ok(updated) : r;
  }

  async softDelete(id: NodeId): Promise<Result<FsNode>> {
    const g = this.guardMutable(this.nodes.get(id), 'delete');
    if (!g.ok) return g;
    const node = g.value;
    // A folder containing read-only items cannot be deleted (protects story files).
    if (node.kind === 'folder') {
      const blocked = this.descendants(id).find((d) => d.readOnly || d.system);
      if (blocked) return err('READ_ONLY', `'${node.name}' contains the protected item '${blocked.name}'.`);
    }
    const updated = { ...node, deletedAt: this.now(), originalParentId: node.parentId, revision: node.revision + 1 };
    const r = await this.commit({ putNodes: [updated], expect: [{ id, revision: node.revision }] }, [id]);
    return r.ok ? ok(updated) : r;
  }

  /** All nodes below `id`. With `skipDeleted`, separately-deleted subtrees are excluded. */
  descendants(id: NodeId, opts: { skipDeleted?: boolean } = {}): FsNode[] {
    const out: FsNode[] = [];
    const stack = [id];
    let guard = 0;
    while (stack.length && guard++ < LIMITS.maxNodes * 2) {
      const cur = stack.pop()!;
      for (const n of this.nodes.values())
        if (n.parentId === cur && !(opts.skipDeleted && n.deletedAt)) {
          out.push(n);
          stack.push(n.id);
        }
    }
    return out;
  }

  /**
   * Restore from the Recycle Bin. If the original folder is gone (or deleted), restores to
   * My Documents/C:\. On a name collision, `onCollision: 'rename'` picks `name (2)`.
   */
  async restore(id: NodeId, opts: { onCollision?: 'fail' | 'rename' } = {}): Promise<Result<FsNode>> {
    const node = this.nodes.get(id);
    if (!node || !node.deletedAt) return err('NOT_FOUND', 'That item is not in the Recycle Bin.');
    let parentId = node.originalParentId ?? node.parentId ?? ROOT_ID;
    const parent = this.nodes.get(parentId);
    if (!parent || !this.isAccessible(parentId) || parent.kind === 'file') parentId = ROOT_ID;
    let name = node.name;
    if (this.findSibling(parentId, name, id)) {
      if (opts.onCollision !== 'rename') return err('DUPLICATE', `A file named '${name}' already exists in '${this.getDisplayPath(parentId)}'.`);
      name = this.uniqueName(parentId, name);
    }
    const updated: FsNode = { ...node, parentId, name, deletedAt: null, originalParentId: null, revision: node.revision + 1, updatedAt: this.now() };
    const r = await this.commit({ putNodes: [updated], expect: [{ id, revision: node.revision }] }, [id]);
    return r.ok ? ok(updated) : r;
  }

  async purge(id: NodeId): Promise<Result<void>> {
    const node = this.nodes.get(id);
    if (!node || !node.deletedAt) return err('NOT_FOUND', 'That item is not in the Recycle Bin.');
    // Items that were deleted separately keep their own Recycle Bin entry.
    const ids = [id, ...this.descendants(id, { skipDeleted: true }).map((d) => d.id)];
    return this.commit({ deleteIds: ids }, ids);
  }

  async emptyRecycleBin(): Promise<Result<number>> {
    const top = this.listDeleted();
    const ids = top.flatMap((n) => [n.id, ...this.descendants(n.id).map((d) => d.id)]);
    if (ids.length === 0) return ok(0);
    const r = await this.commit({ deleteIds: ids }, ids);
    return r.ok ? ok(top.length) : r;
  }

  /** Re-read specific nodes from storage (used after another tab commits). */
  async refreshFromStorage(ids: NodeId[]) {
    try {
      const { nodes, contents } = await this.adapter.readNodes(ids);
      const found = new Set(nodes.map((n) => n.id));
      for (const id of ids)
        if (!found.has(id)) {
          this.nodes.delete(id);
          this.contents.delete(id);
        }
      for (const n of nodes) this.nodes.set(n.id, n);
      for (const c of contents) this.contents.set(c.nodeId, c.content);
      this.bump();
    } catch {
      /* ignore: storage temporarily unavailable */
    }
  }
}

export function compareNodes(a: FsNode, b: FsNode) {
  const fa = a.kind === 'file' ? 1 : 0;
  const fb = b.kind === 'file' ? 1 : 0;
  if (fa !== fb) return fa - fb;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
}
