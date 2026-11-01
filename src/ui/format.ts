import type { FsNode } from '../domain/fs/types';
import { extensionOf } from '../domain/fs/validation';
import type { IconName } from './icons';
import { SEED_LAUNCHERS } from '../content/seed';

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('en-US')}KB`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const yy = String(d.getFullYear()).slice(-2);
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${mm}/${dd}/${yy} ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
}

export function typeLabel(n: FsNode): string {
  if (n.kind === 'drive') return 'Local Disk';
  if (n.kind === 'folder') return 'File Folder';
  if (SEED_LAUNCHERS[n.id]) return 'Application';
  const ext = extensionOf(n.name);
  if (n.mimeType === 'text/plain') return ext === 'ini' ? 'Configuration Settings' : 'Text Document';
  if (n.mimeType === 'image/svg') return 'Bitmap Image';
  return ext ? `${ext.toUpperCase()} File` : 'File';
}

export function iconFor(n: FsNode): IconName {
  if (n.kind === 'drive') return 'drive';
  if (n.kind === 'folder') return n.hidden ? 'lock' : 'folder';
  if (SEED_LAUNCHERS[n.id]) return n.id === 'seed:exe-vault' ? 'vault' : 'exe';
  if (n.mimeType === 'image/svg') return 'image';
  if (n.mimeType === 'text/plain') return 'document';
  return 'exe';
}
