import type { ReactElement } from 'react';

/** Original pixel-style SVG icons drawn for this project (not Microsoft artwork). */
export type IconName =
  | 'computer' | 'folder' | 'folderOpen' | 'document' | 'recycleEmpty' | 'recycleFull' | 'globe'
  | 'dos' | 'notepad' | 'calculator' | 'control' | 'help' | 'image' | 'lock' | 'exe' | 'run'
  | 'shutdown' | 'programs' | 'documents' | 'warning' | 'info' | 'error' | 'question'
  | 'speaker' | 'speakerMuted' | 'floppy' | 'vault' | 'drive' | 'disk';

const P = { shapeRendering: 'crispEdges' as const };

const shapes: Record<IconName, ReactElement> = {
  computer: (
    <g {...P}>
      <rect x="4" y="3" width="24" height="18" fill="#c0c0c0" stroke="#000" />
      <rect x="7" y="6" width="18" height="12" fill="#008080" />
      <rect x="9" y="8" width="6" height="2" fill="#7fffd4" />
      <rect x="12" y="21" width="8" height="3" fill="#808080" />
      <rect x="6" y="24" width="20" height="5" fill="#c0c0c0" stroke="#000" />
      <rect x="20" y="26" width="4" height="1" fill="#00a000" />
    </g>
  ),
  drive: (
    <g {...P}>
      <rect x="3" y="12" width="26" height="10" fill="#c0c0c0" stroke="#000" />
      <rect x="5" y="18" width="18" height="2" fill="#808080" />
      <rect x="24" y="15" width="3" height="2" fill="#00c000" />
    </g>
  ),
  folder: (
    <g {...P}>
      <path d="M3 8h9l2 2h15v17H3z" fill="#ffd966" stroke="#806000" />
      <rect x="3" y="12" width="26" height="1" fill="#fff2b3" />
    </g>
  ),
  folderOpen: (
    <g {...P}>
      <path d="M3 8h9l2 2h13v4H8L3 27z" fill="#e6b800" stroke="#806000" />
      <path d="M8 14h22l-5 13H3z" fill="#ffd966" stroke="#806000" />
    </g>
  ),
  document: (
    <g {...P}>
      <path d="M7 3h13l6 6v20H7z" fill="#fff" stroke="#000" />
      <path d="M20 3v6h6" fill="#c0c0c0" stroke="#000" />
      <rect x="10" y="13" width="12" height="1" fill="#000080" />
      <rect x="10" y="16" width="12" height="1" fill="#000080" />
      <rect x="10" y="19" width="12" height="1" fill="#000080" />
      <rect x="10" y="22" width="8" height="1" fill="#000080" />
    </g>
  ),
  notepad: (
    <g {...P}>
      <rect x="6" y="5" width="20" height="24" fill="#fff" stroke="#000" />
      <rect x="6" y="3" width="20" height="4" fill="#3a6ea5" stroke="#000" />
      {[11, 14, 17, 20, 23].map((y) => (
        <rect key={y} x="9" y={y} width="14" height="1" fill="#808080" />
      ))}
    </g>
  ),
  recycleEmpty: (
    <g {...P}>
      <path d="M8 9h16l-2 19H10z" fill="#e0e0e0" stroke="#000" />
      <rect x="6" y="6" width="20" height="3" fill="#c0c0c0" stroke="#000" />
      <path d="M13 12v13M16 12v13M19 12v13" stroke="#808080" />
    </g>
  ),
  recycleFull: (
    <g {...P}>
      <path d="M8 9h16l-2 19H10z" fill="#e0e0e0" stroke="#000" />
      <rect x="9" y="3" width="8" height="7" fill="#fff" stroke="#000" transform="rotate(-12 13 6)" />
      <rect x="15" y="4" width="8" height="6" fill="#ffd966" stroke="#000" transform="rotate(10 19 7)" />
      <rect x="6" y="8" width="20" height="3" fill="#c0c0c0" stroke="#000" />
      <path d="M13 14v11M16 14v11M19 14v11" stroke="#808080" />
    </g>
  ),
  globe: (
    <g {...P}>
      <circle cx="16" cy="16" r="12" fill="#3a6ea5" stroke="#000" />
      <path d="M9 9h6v4h-3v5H8zM18 7h5v6h-3v3h4v6h-4v-4h-3z" fill="#2e8b57" />
      <path d="M4 16h24M16 4v24" stroke="#9ec5ff" strokeWidth="0.75" />
    </g>
  ),
  dos: (
    <g {...P}>
      <rect x="3" y="5" width="26" height="22" fill="#000" stroke="#c0c0c0" />
      <rect x="3" y="5" width="26" height="4" fill="#000080" />
      <text x="6" y="21" fontFamily="monospace" fontSize="9" fill="#c0c0c0">C:\&gt;_</text>
    </g>
  ),
  calculator: (
    <g {...P}>
      <rect x="7" y="3" width="18" height="26" fill="#c0c0c0" stroke="#000" />
      <rect x="9" y="5" width="14" height="5" fill="#d8f0d0" stroke="#404040" />
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={9 + c * 5} y={13 + r * 5} width="4" height="3" fill={c === 2 ? '#a00' : '#fff'} stroke="#404040" strokeWidth="0.5" />))}
    </g>
  ),
  control: (
    <g {...P}>
      <rect x="4" y="6" width="24" height="20" fill="#c0c0c0" stroke="#000" />
      <circle cx="11" cy="13" r="3" fill="#ffd966" stroke="#000" />
      <rect x="18" y="10" width="7" height="6" fill="#3a6ea5" stroke="#000" />
      <rect x="8" y="20" width="16" height="2" fill="#808080" />
      <rect x="14" y="18" width="3" height="6" fill="#fff" stroke="#000" />
    </g>
  ),
  help: (
    <g {...P}>
      <rect x="6" y="4" width="20" height="24" fill="#ffff99" stroke="#000" />
      <text x="16" y="23" textAnchor="middle" fontFamily="serif" fontWeight="bold" fontSize="18" fill="#000080">?</text>
    </g>
  ),
  question: (
    <g {...P}>
      <circle cx="16" cy="16" r="12" fill="#fff" stroke="#000080" strokeWidth="2" />
      <text x="16" y="22" textAnchor="middle" fontFamily="serif" fontWeight="bold" fontSize="17" fill="#000080">?</text>
    </g>
  ),
  image: (
    <g {...P}>
      <rect x="4" y="6" width="24" height="20" fill="#fff" stroke="#000" />
      <rect x="6" y="8" width="20" height="16" fill="#87ceeb" />
      <path d="M6 24l6-8 4 5 4-6 6 9z" fill="#2e8b57" />
      <circle cx="21" cy="12" r="2" fill="#ffd700" />
    </g>
  ),
  lock: (
    <g {...P}>
      <path d="M11 14v-4a5 5 0 0110 0v4" fill="none" stroke="#404040" strokeWidth="2.5" />
      <rect x="8" y="14" width="16" height="13" fill="#ffd966" stroke="#000" />
      <rect x="15" y="18" width="2" height="5" fill="#000" />
    </g>
  ),
  vault: (
    <g {...P}>
      <rect x="4" y="4" width="24" height="24" fill="#000" stroke="#00ff66" />
      <circle cx="16" cy="16" r="7" fill="none" stroke="#00ff66" strokeWidth="2" />
      <path d="M16 9v14M9 16h14" stroke="#00ff66" />
      <text x="16" y="10" textAnchor="middle" fontFamily="monospace" fontSize="5" fill="#00ff66">99</text>
    </g>
  ),
  exe: (
    <g {...P}>
      <rect x="4" y="6" width="24" height="20" fill="#c0c0c0" stroke="#000" />
      <rect x="4" y="6" width="24" height="4" fill="#000080" />
      <rect x="8" y="14" width="16" height="8" fill="#fff" stroke="#808080" />
    </g>
  ),
  run: (
    <g {...P}>
      <rect x="4" y="8" width="24" height="16" fill="#c0c0c0" stroke="#000" />
      <path d="M10 16h10l-3-3M20 16l-3 3" stroke="#000080" strokeWidth="2" fill="none" />
    </g>
  ),
  shutdown: (
    <g {...P}>
      <rect x="4" y="6" width="24" height="18" fill="#c0c0c0" stroke="#000" />
      <rect x="7" y="9" width="18" height="12" fill="#000" />
      <circle cx="16" cy="15" r="4" fill="none" stroke="#ff4040" strokeWidth="2" />
      <rect x="15" y="9" width="2" height="5" fill="#ff4040" />
    </g>
  ),
  programs: (
    <g {...P}>
      <rect x="4" y="5" width="18" height="14" fill="#c0c0c0" stroke="#000" />
      <rect x="4" y="5" width="18" height="3" fill="#000080" />
      <rect x="10" y="13" width="18" height="14" fill="#c0c0c0" stroke="#000" />
      <rect x="10" y="13" width="18" height="3" fill="#000080" />
    </g>
  ),
  documents: (
    <g {...P}>
      <path d="M3 9h9l2 2h15v16H3z" fill="#ffd966" stroke="#806000" />
      <path d="M12 4h10l4 4v12H12z" fill="#fff" stroke="#000" />
    </g>
  ),
  warning: (
    <g {...P}>
      <path d="M16 3L30 28H2z" fill="#ffd700" stroke="#000" />
      <rect x="15" y="11" width="3" height="9" fill="#000" />
      <rect x="15" y="22" width="3" height="3" fill="#000" />
    </g>
  ),
  info: (
    <g {...P}>
      <circle cx="16" cy="16" r="12" fill="#fff" stroke="#000080" strokeWidth="2" />
      <rect x="15" y="14" width="3" height="10" fill="#000080" />
      <rect x="15" y="8" width="3" height="3" fill="#000080" />
    </g>
  ),
  error: (
    <g {...P}>
      <circle cx="16" cy="16" r="12" fill="#e00" stroke="#600" />
      <path d="M11 11l10 10M21 11L11 21" stroke="#fff" strokeWidth="3" />
    </g>
  ),
  speaker: (
    <g {...P}>
      <path d="M6 12h5l6-5v18l-6-5H6z" fill="#ffd966" stroke="#000" />
      <path d="M21 11c2 3 2 7 0 10M24 8c4 5 4 11 0 16" fill="none" stroke="#000" strokeWidth="1.5" />
    </g>
  ),
  speakerMuted: (
    <g {...P}>
      <path d="M6 12h5l6-5v18l-6-5H6z" fill="#ffd966" stroke="#000" />
      <path d="M21 12l7 8M28 12l-7 8" stroke="#c00" strokeWidth="2" />
    </g>
  ),
  floppy: (
    <g {...P}>
      <path d="M5 4h19l3 3v21H5z" fill="#202060" stroke="#000" />
      <rect x="10" y="4" width="11" height="8" fill="#c0c0c0" />
      <rect x="17" y="5" width="3" height="6" fill="#202060" />
      <rect x="8" y="16" width="16" height="12" fill="#fff" />
      <rect x="10" y="19" width="12" height="1" fill="#c00" />
    </g>
  ),
  disk: (
    <g {...P}>
      <rect x="4" y="10" width="24" height="12" fill="#c0c0c0" stroke="#000" />
      <rect x="22" y="17" width="3" height="2" fill="#0c0" />
    </g>
  ),
};

export function Icon({ name, size = 32, className }: { name: IconName; size?: 16 | 24 | 32 | 48; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {shapes[name]}
    </svg>
  );
}
