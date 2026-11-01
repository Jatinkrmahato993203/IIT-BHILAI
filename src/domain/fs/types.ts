export type NodeId = string;
export type NodeKind = 'drive' | 'folder' | 'file';
export type MimeType = 'text/plain' | 'image/svg' | 'application/octet-stream';

export type FsNode = {
  id: NodeId;
  parentId: NodeId | null;
  name: string;
  kind: NodeKind;
  mimeType?: MimeType;
  /** For bundled images: key into the trusted asset registry. Never user-controlled. */
  assetId?: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  revision: number;
  hidden?: boolean;
  readOnly?: boolean;
  /** Seeded system folders that cannot be renamed, moved or deleted. */
  system?: boolean;
  deletedAt?: string | null;
  originalParentId?: NodeId | null;
};

export type TextContent = { nodeId: NodeId; content: string };

export const ROOT_ID: NodeId = 'seed:root';
export const RECYCLE_ID: NodeId = 'seed:recycled';

/** Product limits (not browser limits) — see blueprint ch. 08. */
export const LIMITS = {
  nameMaxLength: 80,
  textMaxBytes: 256 * 1024,
  maxDepth: 16,
  maxNodes: 2000,
  pathMaxLength: 260,
} as const;
