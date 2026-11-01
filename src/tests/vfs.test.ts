import { beforeEach, describe, expect, it } from 'vitest';
import { VfsService } from '../domain/fs/service';
import { ROOT_ID } from '../domain/fs/types';
import { MemoryAdapter } from '../persistence/memoryAdapter';
import { IdbAdapter } from '../persistence/idbAdapter';
import { bootstrap, seedIfNeeded } from '../persistence/bootstrap';
import { buildSeed, SEED_IDS, SEED_VERSION } from '../content/seed';

async function makeVfs() {
  const adapter = new MemoryAdapter();
  await seedIfNeeded(adapter);
  const snap = await adapter.load();
  let n = 0;
  const vfs = new VfsService(adapter, { newId: () => `u:test-${++n}`, now: () => '2026-11-01T00:00:00.000Z' });
  vfs.hydrate(snap.nodes, snap.contents);
  return { vfs, adapter };
}

describe('seed', () => {
  it('has unique ids, valid parents, no cycles and unique sibling names', () => {
    const { nodes } = buildSeed();
    const ids = new Set(nodes.map((n) => n.id));
    expect(ids.size).toBe(nodes.length);
    for (const n of nodes) {
      if (n.parentId === null) {
        expect(n.id).toBe(ROOT_ID);
        continue;
      }
      expect(ids.has(n.parentId)).toBe(true);
      const parent = nodes.find((p) => p.id === n.parentId)!;
      expect(parent.kind).not.toBe('file');
      if (n.deletedAt) continue;
      const clash = nodes.filter((s) => s.parentId === n.parentId && !s.deletedAt && s.name.toLowerCase() === n.name.toLowerCase());
      expect(clash.length).toBe(1);
    }
  });
  it('no seeded file is dated in or after 2000', () => {
    for (const n of buildSeed().nodes) expect(n.createdAt < '2000-01-01').toBe(true);
  });
});

describe('VfsService', () => {
  let vfs: VfsService;
  let adapter: MemoryAdapter;
  beforeEach(async () => {
    ({ vfs, adapter } = await makeVfs());
  });

  it('lists children with folders first and hides hidden/deleted nodes', () => {
    const names = vfs.listChildren(ROOT_ID).map((n) => n.name);
    expect(names).toEqual(['My Documents', 'My Pictures', 'Program Files', 'Windows']);
    const docs = vfs.listChildren(SEED_IDS.docs).map((n) => n.name);
    expect(docs[0]).toBe('letters');
    expect(docs).not.toContain('final_final_REAL_FINAL.txt');
  });

  it('reveals hidden folder only when story allows', () => {
    expect(vfs.resolvePath('C:\\TOP_SECRET').ok).toBe(false);
    vfs.setRevealed([SEED_IDS.secret]);
    expect(vfs.resolvePath('c:\\top_secret\\SURVIVAL_PLAN.TXT')).toEqual({ ok: true, value: SEED_IDS.plan });
  });

  it('resolves paths case-insensitively and rejects traversal', () => {
    expect(vfs.resolvePath('C:\\my documents\\LETTERS\\unsent_1999.txt')).toEqual({ ok: true, value: SEED_IDS.unsent });
    expect(vfs.resolvePath('C:\\My Documents\\..\\Windows').ok).toBe(false);
    const r = vfs.resolvePath('C:\\My Documents\\journal.txt\\x');
    expect(r.ok).toBe(false);
  });

  it('creates, reads and writes text with revisions (TC-005 logic)', async () => {
    const c = await vfs.createText(SEED_IDS.docs, 'new note.txt', 'hello');
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const w = await vfs.writeText(c.value.id, 'hello world', 1);
    expect(w.ok && w.value.revision).toBe(2);
    const r = vfs.readText(c.value.id);
    expect(r.ok && r.value.text).toBe('hello world');
    // persisted in adapter
    const snap = await adapter.load();
    expect(snap.contents.find((x) => x.nodeId === c.value.id)?.content).toBe('hello world');
  });

  it('rejects case-insensitive duplicates (TC-009)', async () => {
    expect((await vfs.createText(SEED_IDS.docs, 'Note.txt', '')).ok).toBe(true);
    const dup = await vfs.createText(SEED_IDS.docs, 'note.TXT', '');
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('DUPLICATE');
  });

  it('detects stale revision conflicts between two windows (TC-008)', async () => {
    const r = await vfs.writeText(SEED_IDS.school, 'A saved', 1);
    expect(r.ok).toBe(true);
    const stale = await vfs.writeText(SEED_IDS.school, 'B stale', 1);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('CONFLICT');
    const t = vfs.readText(SEED_IDS.school);
    expect(t.ok && t.value.text).toBe('A saved');
  });

  it('does not change cache when storage fails (no false save)', async () => {
    adapter.failNext = 'QUOTA';
    const r = await vfs.writeText(SEED_IDS.school, 'lost?', 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('QUOTA');
    const t = vfs.readText(SEED_IDS.school);
    expect(t.ok && t.value.text).not.toBe('lost?');
    expect(vfs.getNode(SEED_IDS.school)!.revision).toBe(1);
  });

  it('protects read-only story files and system folders', async () => {
    expect((await vfs.writeText(SEED_IDS.checklist, 'x', 1)).ok).toBe(false);
    expect((await vfs.softDelete(SEED_IDS.readme)).ok).toBe(false);
    expect((await vfs.rename(SEED_IDS.docs, 'Docs')).ok).toBe(false);
    expect((await vfs.softDelete(SEED_IDS.letters)).ok).toBe(false); // contains read-only letter
    expect((await vfs.createText(SEED_IDS.windows, 'virus.txt', '')).ok).toBe(false);
    expect((await vfs.softDelete(ROOT_ID)).ok).toBe(false);
  });

  it('enforces text size limit', async () => {
    const big = 'x'.repeat(256 * 1024 + 1);
    const r = await vfs.createText(SEED_IDS.docs, 'big.txt', big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('TOO_LARGE');
  });

  it('prevents moving a folder into itself or its descendant', async () => {
    const a = await vfs.createFolder(SEED_IDS.docs, 'a');
    if (!a.ok) throw new Error();
    const b = await vfs.createFolder(a.value.id, 'b');
    if (!b.ok) throw new Error();
    expect((await vfs.move(a.value.id, b.value.id)).ok).toBe(false);
    expect((await vfs.move(a.value.id, a.value.id)).ok).toBe(false);
    expect((await vfs.move(b.value.id, SEED_IDS.docs)).ok).toBe(true);
  });

  it('recycle bin: delete, restore, collision rename, purge', async () => {
    expect(vfs.listDeleted().map((n) => n.id)).toContain(SEED_IDS.finalFinal);
    const d = await vfs.softDelete(SEED_IDS.shopping);
    expect(d.ok).toBe(true);
    expect(vfs.listChildren(SEED_IDS.docs).some((n) => n.id === SEED_IDS.shopping)).toBe(false);
    expect(vfs.readText(SEED_IDS.shopping).ok).toBe(false);
    // collision
    await vfs.createText(SEED_IDS.docs, 'shopping_list.txt', 'new');
    const fail = await vfs.restore(SEED_IDS.shopping);
    expect(fail.ok).toBe(false);
    const ok2 = await vfs.restore(SEED_IDS.shopping, { onCollision: 'rename' });
    expect(ok2.ok && ok2.value.name).toBe('shopping_list (2).txt');
    expect(vfs.readText(SEED_IDS.shopping).ok).toBe(true);
    const purge = await vfs.purge(SEED_IDS.finalFinal);
    expect(purge.ok).toBe(true);
    expect(vfs.getNode(SEED_IDS.finalFinal)).toBeUndefined();
  });

  it('restores to C:\\ when original parent was deleted', async () => {
    const f = await vfs.createFolder(SEED_IDS.docs, 'temp');
    if (!f.ok) throw new Error();
    const t = await vfs.createText(f.value.id, 'inner.txt', 'x');
    if (!t.ok) throw new Error();
    await vfs.softDelete(t.value.id);
    await vfs.softDelete(f.value.id);
    await vfs.purge(f.value.id);
    expect(vfs.listDeleted().map((n) => n.id)).toContain(t.value.id);
    const r = await vfs.restore(t.value.id);
    expect(r.ok && r.value.parentId).toBe(ROOT_ID);
  });

  it('files inside a deleted folder are not writable', async () => {
    const f = await vfs.createFolder(SEED_IDS.docs, 'temp');
    if (!f.ok) throw new Error();
    const t = await vfs.createText(f.value.id, 'inner.txt', 'x');
    if (!t.ok) throw new Error();
    await vfs.softDelete(f.value.id);
    const w = await vfs.writeText(t.value.id, 'y', 1);
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.error.code).toBe('NOT_FOUND');
  });

  it('treats XSS payloads in names and contents as inert data', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    expect((await vfs.createText(SEED_IDS.docs, payload, payload)).ok).toBe(false); // < > rejected in names
    const ok1 = await vfs.createText(SEED_IDS.docs, 'payload.txt', payload);
    expect(ok1.ok).toBe(true);
    if (ok1.ok) expect(vfs.readText(ok1.value.id).ok && (vfs.readText(ok1.value.id) as { value: { text: string } }).value.text).toBe(payload);
  });
});

describe('IndexedDB adapter (fake-indexeddb)', () => {
  it('seeds once and never overwrites user edits on reload', async () => {
    const first = await bootstrap();
    expect(first.adapter.kind).toBe('indexeddb');
    expect(first.storageWarning).toBeNull();
    const w = await first.vfs.writeText(SEED_IDS.school, 'my edit', 1);
    expect(w.ok).toBe(true);
    const second = await bootstrap();
    const t = second.vfs.readText(SEED_IDS.school);
    expect(t.ok && t.value.text).toBe('my edit');
  });

  it('enforces revision inside the transaction (cross-tab conflict)', async () => {
    const a = await bootstrap();
    const b = await bootstrap();
    const ra = await a.vfs.writeText(SEED_IDS.journal, 'tab A', a.vfs.getNode(SEED_IDS.journal)!.revision);
    expect(ra.ok).toBe(true);
    // tab B's cache is stale but passes its local check; the IDB transaction must reject it.
    const rb = await b.vfs.writeText(SEED_IDS.journal, 'tab B', b.vfs.getNode(SEED_IDS.journal)!.revision);
    expect(rb.ok).toBe(false);
    if (!rb.ok) expect(rb.error.code).toBe('CONFLICT');
    const idb = await IdbAdapter.open();
    const snap = await idb.load();
    expect(snap.contents.find((c) => c.nodeId === SEED_IDS.journal)?.content).toBe('tab A');
  });

  it('falls back to session-only memory when forced', async () => {
    const b = await bootstrap({ forceMemory: true });
    expect(b.adapter.kind).toBe('memory');
    expect(b.storageWarning).toMatch(/lost/);
  });
});

describe('seed v2: daily routine diary', () => {
  it('is in My Documents with the exact text', async () => {
    const { vfs } = await makeVfs();
    const id = vfs.resolvePath('C:\\My Documents\\my_daily_routine_1995.txt');
    expect(id).toEqual({ ok: true, value: SEED_IDS.diary1995 });
    const t = vfs.readText(SEED_IDS.diary1995);
    expect(t.ok && t.value.text.startsWith('MY SECRET DIARY\nYEAR: 1995\nAGE: 15')).toBe(true);
    expect(t.ok && t.value.text.trimEnd().endsWith('please cancel Monday.')).toBe(true);
    expect(t.ok && t.value.node.readOnly).toBeFalsy();
  });

  it('upgrading a v1 disk adds the diary without overwriting user edits', async () => {
    const adapter = new MemoryAdapter();
    const seed = buildSeed();
    const v1Nodes = seed.nodes.filter((n) => n.id !== SEED_IDS.diary1995);
    const v1Contents = seed.contents.filter((c) => c.nodeId !== SEED_IDS.diary1995).map((c) => (c.nodeId === SEED_IDS.school ? { ...c, content: 'user edit' } : c));
    await adapter.commitFs({ putNodes: v1Nodes, putContents: v1Contents, seedVersion: 1 });
    await seedIfNeeded(adapter);
    const snap = await adapter.load();
    expect(snap.seedVersion).toBe(SEED_VERSION);
    expect(snap.nodes.some((n) => n.id === SEED_IDS.diary1995)).toBe(true);
    expect(snap.contents.find((c) => c.nodeId === SEED_IDS.school)?.content).toBe('user edit');
  });
});

describe('seed v3: meme folder', () => {
  it('contains the image, which opens as an image (not text)', async () => {
    const { vfs } = await makeVfs();
    expect(vfs.resolvePath('C:\\My Documents\\meme\\satyagraha_vs_56k.jpg')).toEqual({ ok: true, value: SEED_IDS.memeGandhi });
    const r = vfs.readText(SEED_IDS.memeGandhi);
    expect(r.ok).toBe(false);
    expect(vfs.getNode(SEED_IDS.memeGandhi)?.mimeType).toBe('image/jpeg');
  });
});
