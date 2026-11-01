import { useEffect, useRef, useState } from 'react';

const POST_LINES = [
  'SysBIOS (C) 1998 Imaginary Megatrends, Inc.  Rev 4.51PG',
  'PENTIUM-II CPU at 233MHz',
  'Memory Test :  32768K OK',
  '',
  'Detecting IDE Primary Master ... SYSADMIN-99 HDD 6.4GB',
  'Detecting IDE Primary Slave  ... None',
  'Detecting Floppy Drive A:    ... Floppy #3 not found (check tiffin box)',
  'CMOS battery ................ DEAD (since 31-12-1999 23:58)',
  '',
  'Starting The Last Login 98...',
];

/**
 * Power-on screen. Phase "off" requires an explicit, accessible action. The POST/splash
 * sequence is skippable (button, Enter, Escape, Space) and shortened under reduced motion.
 */
export function BootScreen({ ready, reduceMotion, skipAnimation, onPowerOn, onDone, poweredOn }: {
  ready: boolean;
  reduceMotion: boolean;
  skipAnimation: boolean;
  poweredOn: boolean;
  onPowerOn: () => void;
  onDone: () => void;
}) {
  const [lines, setLines] = useState(0);
  const [splash, setSplash] = useState(false);
  const [skipRequested, setSkipRequested] = useState(false);
  const startBtn = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!poweredOn) startBtn.current?.focus();
  }, [poweredOn]);

  const instant = skipAnimation || reduceMotion;
  const showSplash = splash || (poweredOn && instant);

  useEffect(() => {
    if (!poweredOn || instant) return;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setLines(i);
      if (i >= POST_LINES.length) {
        clearInterval(t);
        setTimeout(() => setSplash(true), 350);
      }
    }, 170);
    return () => clearInterval(t);
  }, [poweredOn, instant]);

  // Leave the splash once data is ready and either the animation finished or skip was requested.
  useEffect(() => {
    if (!poweredOn || !ready || doneRef.current) return;
    if (skipRequested) {
      doneRef.current = true;
      onDone();
      return;
    }
    if (!showSplash) return;
    const t = setTimeout(() => {
      doneRef.current = true;
      onDone();
    }, instant ? 250 : 1600);
    return () => clearTimeout(t);
  }, [poweredOn, ready, showSplash, skipRequested, instant, onDone]);

  useEffect(() => {
    if (!poweredOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', 'Escape', ' '].includes(e.key)) {
        e.preventDefault();
        setSkipRequested(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [poweredOn]);

  if (!poweredOn) {
    return (
      <main className="power-screen">
        <h1 className="power-title">The Last Login</h1>
        <p className="power-sub">An abandoned computer. Last used 31 December 1999, 11:58 PM.</p>
        <button ref={startBtn} className="power-button" onClick={onPowerOn}>
          <span aria-hidden="true">⏻</span> Start Computer
        </button>
        <p className="power-small">
          A fan-made, Windows&nbsp;98-inspired experience. Not affiliated with Microsoft. Sound is off by default.
          <br />
          Everything stays in your browser. Keyboard: Tab/Enter everywhere, Ctrl+Esc opens Start.
        </p>
      </main>
    );
  }

  return (
    <main className={`boot-screen${showSplash ? ' splash' : ''}`} aria-busy={!ready} onClick={() => setSkipRequested(true)}>
      {!showSplash ? (
        <pre className="post" aria-live="polite">
          {POST_LINES.slice(0, lines).join('\n')}
          <span className="cursor">_</span>
        </pre>
      ) : (
        <div className="splash-inner">
          <div className="splash-logo" aria-hidden="true">
            <span className="flag">
              <i /><i /><i /><i />
            </span>
          </div>
          <h1 className="splash-title">
            The Last Login <sup>98</sup>
          </h1>
          <div className={`splash-bar${reduceMotion ? ' still' : ''}`} role="progressbar" aria-label="Starting up" aria-valuetext={ready ? 'Almost ready' : 'Loading'} />
          {!ready && <p className="splash-wait">Reading drive C: ...</p>}
        </div>
      )}
      <button className="skip-boot" onClick={(e) => { e.stopPropagation(); setSkipRequested(true); }}>
        Skip
      </button>
    </main>
  );
}

export function SafeToTurnOff({ onPowerOn }: { onPowerOn: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <main className="safe-off">
      <h1 className="safe-off-text">It's now safe to turn off your computer.</h1>
      <p className="safe-off-sub">(Your files are still here. So is the floppy.)</p>
      <button ref={ref} onClick={onPowerOn}>
        Turn the computer back on
      </button>
    </main>
  );
}
