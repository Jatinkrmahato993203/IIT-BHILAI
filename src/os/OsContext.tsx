import { createContext, useContext, useSyncExternalStore, type Dispatch } from 'react';
import type { VfsService } from '../domain/fs/service';
import type { NodeId } from '../domain/fs/types';
import type { Settings } from '../domain/settings';
import type { StoryEvent, StoryState } from '../domain/story/engine';
import type { AppId } from '../shell/appIds';
import type { WindowAction, WindowState } from '../shell/windowReducer';
import type { IconName } from '../ui/icons';
import type { ModalButton } from '../ui/Modal';
import type { SoundName } from '../ui/sound';

export type MessageOptions = {
  title: string;
  text: string | string[];
  icon?: IconName;
  buttons?: ModalButton[];
  cancelValue?: string;
};

export type CloseGuard = () => Promise<boolean>;

export type OsApi = {
  vfs: VfsService;
  story: StoryState;
  emit: (e: StoryEvent) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  storageKind: 'indexeddb' | 'memory';
  storageWarning: string | null;
  reduceMotion: boolean;
  openApp: (appId: AppId, args?: Record<string, string>) => string | null;
  openNode: (id: NodeId) => void;
  setTitle: (windowId: string, title: string) => void;
  requestClose: (windowId: string) => Promise<boolean>;
  registerCloseGuard: (windowId: string, guard: CloseGuard | null) => void;
  setDirty: (windowId: string, dirty: boolean) => void;
  message: (opts: MessageOptions) => Promise<string>;
  resetStory: () => Promise<void>;
  resetFilesystem: () => Promise<void>;
  clipboard: { nodeId: NodeId } | null;
  setClipboard: (c: { nodeId: NodeId } | null) => void;
  recent: NodeId[];
  playSound: (s: SoundName) => void;
  shutdown: (mode: 'shutdown' | 'restart') => Promise<void>;
  arrangeWindows: () => void;
  showRun: () => void;
  showShutdown: () => void;
};

export const OsContext = createContext<OsApi | null>(null);
export const WindowsContext = createContext<{ state: WindowState; dispatch: Dispatch<WindowAction> } | null>(null);

export function useOs(): OsApi {
  const v = useContext(OsContext);
  if (!v) throw new Error('useOs outside OsProvider');
  return v;
}

export function useWindows() {
  const v = useContext(WindowsContext);
  if (!v) throw new Error('useWindows outside OsProvider');
  return v;
}

/** Re-render when the virtual filesystem changes. */
export function useVfsVersion(vfs: VfsService) {
  return useSyncExternalStore(vfs.subscribe, vfs.getVersion, vfs.getVersion);
}
