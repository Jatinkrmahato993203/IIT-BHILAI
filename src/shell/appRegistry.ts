import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { IconName } from '../ui/icons';
import type { AppId } from './appIds';

export type AppProps = { windowId: string; args: Record<string, string>; active: boolean };

export type AppDefinition = {
  id: AppId;
  title: string;
  icon: IconName;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  /** Singleton apps focus their existing window instead of opening another. */
  singleton?: boolean;
  component: LazyExoticComponent<ComponentType<AppProps>>;
};

/** Literal allowlist: an appId string can only ever resolve to one of these modules. */
export const APPS: Record<AppId, AppDefinition> = {
  explorer: { id: 'explorer', title: 'Exploring', icon: 'folderOpen', width: 560, height: 380, minWidth: 300, minHeight: 200, component: lazy(() => import('../apps/explorer/Explorer')) },
  notepad: { id: 'notepad', title: 'Untitled - Notepad', icon: 'notepad', width: 520, height: 400, minWidth: 260, minHeight: 160, component: lazy(() => import('../apps/notepad/Notepad')) },
  calculator: { id: 'calculator', title: 'Calculator', icon: 'calculator', width: 260, height: 290, resizable: false, singleton: true, component: lazy(() => import('../apps/calculator/Calculator')) },
  browser: { id: 'browser', title: 'The Internet', icon: 'globe', width: 640, height: 460, minWidth: 320, minHeight: 240, singleton: true, component: lazy(() => import('../apps/browser/RetroBrowser')) },
  terminal: { id: 'terminal', title: 'MS-DOS Prompt', icon: 'dos', width: 600, height: 360, minWidth: 300, minHeight: 180, component: lazy(() => import('../apps/terminal/Terminal')) },
  recycle: { id: 'recycle', title: 'Recycle Bin', icon: 'recycleEmpty', width: 520, height: 320, minWidth: 300, minHeight: 180, singleton: true, component: lazy(() => import('../apps/recycle/RecycleBin')) },
  vault: { id: 'vault', title: 'SYSADMIN-99 Vault', icon: 'vault', width: 420, height: 330, resizable: false, singleton: true, component: lazy(() => import('../apps/vault/Vault')) },
  imageviewer: { id: 'imageviewer', title: 'Imaging', icon: 'image', width: 440, height: 380, minWidth: 240, minHeight: 200, component: lazy(() => import('../apps/imageviewer/ImageViewer')) },
  control: { id: 'control', title: 'Control Panel', icon: 'control', width: 460, height: 440, minWidth: 300, minHeight: 240, singleton: true, component: lazy(() => import('../apps/control/ControlPanel')) },
  help: { id: 'help', title: 'Windows Help', icon: 'help', width: 480, height: 420, minWidth: 300, minHeight: 240, singleton: true, component: lazy(() => import('../apps/help/Help')) },
};
