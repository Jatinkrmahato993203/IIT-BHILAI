import { SEED_IDS } from '../content/seed';
import type { IconName } from '../ui/icons';
import type { AppId } from './appIds';

export type DesktopIcon = { id: string; label: string; icon: IconName; app?: AppId; args?: Record<string, string>; nodeId?: string };

export const DESKTOP_ICONS: DesktopIcon[] = [
  { id: 'mycomputer', label: 'My Computer', icon: 'computer', app: 'explorer', args: { folderId: SEED_IDS.root } },
  { id: 'mydocs', label: 'My Documents', icon: 'documents', app: 'explorer', args: { folderId: SEED_IDS.docs } },
  { id: 'recycle', label: 'Recycle Bin', icon: 'recycleFull', app: 'recycle' },
  { id: 'internet', label: 'The Internet', icon: 'globe', app: 'browser' },
  { id: 'dos', label: 'MS-DOS Prompt', icon: 'dos', app: 'terminal' },
  { id: 'notepad', label: 'Notepad', icon: 'notepad', app: 'notepad' },
  { id: 'readme', label: 'Read Me First', icon: 'document', nodeId: SEED_IDS.readme },
];
