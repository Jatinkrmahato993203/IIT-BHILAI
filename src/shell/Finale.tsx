import { useEffect, useRef } from 'react';
import { SEED_IDS } from '../content/seed';
import { useOs } from '../os/OsContext';
import { Modal } from '../ui/Modal';

export function BlueScreen({ onDismiss }: { onDismiss: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const done = useRef(false);
  const dismiss = () => {
    if (done.current) return;
    done.current = true;
    onDismiss();
  };
  useEffect(() => {
    btn.current?.focus();
    // Ignore the key/click that opened the file; accept input shortly after.
    const t = setTimeout(() => {
      const onKey = (e: KeyboardEvent) => {
        if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
        e.preventDefault();
        dismiss();
      };
      window.addEventListener('keydown', onKey, { capture: true, once: true });
      cleanup = () => window.removeEventListener('keydown', onKey, { capture: true });
    }, 400);
    let cleanup = () => {};
    return () => {
      clearTimeout(t);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="bsod" role="alertdialog" aria-modal="true" aria-labelledby="bsod-title" aria-describedby="bsod-body" onClick={dismiss}>
      <div className="bsod-inner">
        <h2 id="bsod-title" className="bsod-title">
          Windows
        </h2>
        <div id="bsod-body">
          <p>A fatal exception 0xLOVE has occurred at 0028:C0FFEE99 in VXD SYSADMIN99(01) + 00001999.</p>
          <p>The system has detected one (1) unsent confession and zero (0) valid backup plans.</p>
          <p>* Press any key to continue being embarrassed.</p>
          <p>* Press CTRL+ALT+DEL to restart your feelings. You will lose any unsaved courage.</p>
          <p className="bsod-note">(This is a joke screen. Nothing on your computer has crashed.)</p>
        </div>
        <button ref={btn} className="bsod-button" onClick={dismiss}>
          Press any key to continue _
        </button>
      </div>
    </div>
  );
}

const HEARTS = Array.from({ length: 18 }, (_, i) => i);

export function Finale({ onClose }: { onClose: () => void }) {
  const os = useOs();
  return (
    <>
      <div className={`confetti${os.reduceMotion ? ' still' : ''}`} aria-hidden="true">
        {HEARTS.map((i) => (
          <span key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.35}s` }}>
            {i % 3 === 0 ? '♥' : i % 3 === 1 ? '▪' : '♥'}
          </span>
        ))}
      </div>
      <Modal
        title="SYSADMIN-99 — Mission Report"
        icon="floppy"
        width={420}
        cancelValue="close"
        buttons={[
          { label: 'Read Floppy #3', value: 'floppy', primary: true },
          { label: 'Replay Mystery', value: 'replay' },
          { label: 'Close', value: 'close' },
        ]}
        onResult={async (v) => {
          onClose();
          if (v === 'floppy') os.openNode(SEED_IDS.confession);
          if (v === 'replay') {
            const c = await os.message({
              title: 'Replay mystery',
              icon: 'question',
              text: ['Reset the story progress and hide C:\\TOP_SECRET again?', 'Your own files and edits are kept.'],
              buttons: [
                { label: 'Replay', value: 'yes', primary: true },
                { label: 'Cancel', value: 'no' },
              ],
              cancelValue: 'no',
            });
            if (c === 'yes') await os.resetStory();
          }
        }}
      >
        <p><strong>Mystery solved.</strong></p>
        <p>The computer survived Y2K. Aarav never sent the letter.</p>
        <p>The only thing that crashed was his confidence.</p>
        <p className="small">The taskbar clock has finally reached 12:00 AM. Welcome to the year 2000 — 26 years late.</p>
      </Modal>
    </>
  );
}
