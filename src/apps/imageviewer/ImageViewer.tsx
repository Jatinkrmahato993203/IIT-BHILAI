import { useEffect, type ReactElement } from 'react';
import { useOs, useVfsVersion } from '../../os/OsContext';
import type { AppProps } from '../../shell/appRegistry';
import memeGandhi from '../../assets/memes/satyagraha_vs_56k.jpg';

/** Trusted registry of original illustrations. Image files reference these by assetId only. */
const ASSETS: Record<string, { alt: string; caption: string; art: ReactElement }> = {
  'meme-gandhi': {
    alt: 'Cartoon of Mahatma Gandhi smiling patiently at a beige 1990s computer whose screen reads "Page loading... 15%", under a neon GeoCities-style banner: "Satyagraha against 56K dial-up: supreme patience is waiting for a webpage to load".',
    caption: 'satyagraha_vs_56k — forwarded 47 times. Still loading.',
    art: <img src={memeGandhi} alt="" className="image-raster" draggable={false} />,
  },
  summer: {
    alt: 'Pixel-art beach at sunset: an orange sun over the sea, a red kite with "1999" written on it, and two small figures on the sand.',
    caption: 'summer_1999 — Juhu beach. Riya said the kite was "kind of cool". (It was.)',
    art: (
      <svg viewBox="0 0 160 120" width="100%" height="100%" shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet">
        <rect width="160" height="70" fill="#ff9e5e" />
        <rect y="20" width="160" height="25" fill="#ffb07a" />
        <rect y="45" width="160" height="25" fill="#ffc896" />
        <circle cx="110" cy="62" r="14" fill="#ffdf40" />
        <rect y="70" width="160" height="22" fill="#2a6f97" />
        <rect y="76" width="160" height="2" fill="#4a8fb7" />
        <rect y="84" width="160" height="2" fill="#4a8fb7" />
        <rect y="92" width="160" height="28" fill="#e9c98b" />
        <polygon points="40,18 52,30 40,42 28,30" fill="#d62828" />
        <text x="40" y="33" fontSize="6" textAnchor="middle" fill="#fff" fontFamily="monospace">1999</text>
        <path d="M40 42 Q46 70 58 100" stroke="#333" fill="none" strokeWidth="0.6" />
        <rect x="56" y="96" width="4" height="10" fill="#1d3557" />
        <rect x="56" y="92" width="4" height="4" fill="#8d5524" />
        <rect x="64" y="97" width="4" height="9" fill="#9d4edd" />
        <rect x="64" y="93" width="4" height="4" fill="#8d5524" />
      </svg>
    ),
  },
  setup: {
    alt: 'Pixel-art desk with a beige CRT monitor showing a teal desktop, a keyboard, three candles and a steel tiffin box.',
    caption: 'my_setup — SYSADMIN-99 on day one. 233 MHz of pure power.',
    art: (
      <svg viewBox="0 0 160 120" width="100%" height="100%" shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet">
        <rect width="160" height="120" fill="#3d405b" />
        <rect y="84" width="160" height="36" fill="#8b5e34" />
        <rect x="40" y="20" width="70" height="56" fill="#e8e1c9" />
        <rect x="47" y="26" width="56" height="40" fill="#008080" />
        <rect x="50" y="29" width="8" height="8" fill="#ffd966" />
        <rect x="50" y="40" width="8" height="8" fill="#c0c0c0" />
        <rect x="47" y="62" width="56" height="4" fill="#c0c0c0" />
        <rect x="65" y="76" width="20" height="8" fill="#d8d0b8" />
        <rect x="45" y="88" width="62" height="10" fill="#e8e1c9" />
        <rect x="118" y="70" width="5" height="16" fill="#fff" />
        <rect x="126" y="66" width="5" height="20" fill="#fff" />
        <rect x="134" y="72" width="5" height="14" fill="#fff" />
        <rect x="119" y="66" width="3" height="4" fill="#ffb703" />
        <rect x="127" y="62" width="3" height="4" fill="#ffb703" />
        <rect x="135" y="68" width="3" height="4" fill="#ffb703" />
        <rect x="10" y="68" width="22" height="18" fill="#adb5bd" />
        <rect x="10" y="64" width="22" height="4" fill="#ced4da" />
        <rect x="18" y="60" width="6" height="4" fill="#6c757d" />
      </svg>
    ),
  },
};

export default function ImageViewer({ windowId, args }: AppProps) {
  const os = useOs();
  useVfsVersion(os.vfs);
  const node = args.fileId ? os.vfs.getNode(args.fileId) : undefined;
  const asset = node?.assetId ? ASSETS[node.assetId] : undefined;
  useEffect(() => {
    os.setTitle(windowId, `${node?.name ?? 'Untitled'} - Imaging`);
  }, [node?.name, os, windowId]);
  if (!node || !asset || !os.vfs.isAccessible(node.id))
    return <div className="app imageviewer"><p className="filelist-empty">The picture could not be displayed.</p></div>;
  return (
    <div className="app imageviewer">
      <figure className="image-frame sunken-panel" tabIndex={0} data-autofocus="true" aria-label={node.name}>
        <div className="image-art" role="img" aria-label={asset.alt}>
          {asset.art}
        </div>
        <figcaption>{asset.caption}</figcaption>
      </figure>
    </div>
  );
}
