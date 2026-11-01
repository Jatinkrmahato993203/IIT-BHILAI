import { useCallback, useEffect, useMemo, useState } from 'react';
import { OsProvider } from './os/OsProvider';
import { bootstrap, type Boot } from './persistence/bootstrap';
import { sanitizeSettings } from './domain/settings';
import { sanitizeStory } from './domain/story/engine';
import { BootScreen, SafeToTurnOff } from './shell/BootScreen';
import { Desktop } from './shell/Desktop';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { playSound } from './ui/sound';

type Phase = 'off' | 'booting' | 'desktop' | 'shutdown';

function useSystemReducedMotion() {
  return useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
}

export default function App() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [bootError, setBootError] = useState(false);
  const [phase, setPhase] = useState<Phase>('off');
  const [session, setSession] = useState(0);
  const sysReduced = useSystemReducedMotion();

  useEffect(() => {
    let cancelled = false;
    performance.mark?.('boot-start');
    const forceMemory = new URLSearchParams(location.search).has('session-only');
    bootstrap({ forceMemory })
      .then((b) => !cancelled && setBoot(b))
      .catch(() => !cancelled && setBootError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const settings = boot?.settings;
  const reduceMotion = settings ? settings.motion === 'reduce' || (settings.motion === 'system' && sysReduced) : sysReduced;

  const onDone = useCallback(() => {
    setPhase('desktop');
    performance.mark?.('desktop-ready');
  }, []);
  const hooks = useMemo(
    () => ({
      onShutdown: (mode: 'shutdown' | 'restart') => {
        // Re-read persisted story/settings so the next session starts from the latest state.
        setBoot((b) => {
          if (b)
            void b.adapter.load().then(
              (snap) => setBoot((cur) => (cur ? { ...cur, story: sanitizeStory(snap.story), settings: sanitizeSettings(snap.settings) } : cur)),
              () => undefined,
            );
          return b;
        });
        setSession((s) => s + 1);
        setPhase(mode === 'restart' ? 'booting' : 'shutdown');
      },
    }),
    [],
  );

  if (bootError)
    return (
      <main className="safe-off">
        <h1 className="safe-off-text">Drive C: could not be read.</h1>
        <button onClick={() => location.reload()}>Restart</button>
      </main>
    );

  const rootAttrs = {
    className: 'os-root',
    'data-reduce-motion': reduceMotion ? 'true' : 'false',
    'data-focus': settings?.highContrastFocus ? 'strong' : 'normal',
    style: { ['--ui-scale' as string]: String((settings?.textScale ?? 100) / 100) },
  };

  return (
    <div {...rootAttrs}>
      <ErrorBoundary
        fallback={(_e, reset) => (
          <main className="bsod" role="alert">
            <div className="bsod-inner">
              <h1 className="bsod-title">Windows</h1>
              <p>A real (unplanned) error occurred in the desktop. Your saved files are safe in browser storage.</p>
              <button className="bsod-button" onClick={reset}>Try again</button>{' '}
              <button className="bsod-button" onClick={() => location.reload()}>Restart</button>
            </div>
          </main>
        )}
      >
        {(phase === 'off' || phase === 'booting') && (
          <BootScreen
            ready={!!boot}
            poweredOn={phase === 'booting'}
            reduceMotion={reduceMotion}
            skipAnimation={!!settings?.skipBootAnimation}
            onPowerOn={() => {
              setPhase('booting');
              playSound('startup', !!boot?.settings.sound);
            }}
            onDone={onDone}
          />
        )}
        {phase === 'shutdown' && <SafeToTurnOff onPowerOn={() => setPhase('booting')} />}
        {phase === 'desktop' && boot && (
          <OsProvider key={session} boot={boot} hooks={hooks} render={(ui) => <Desktop {...ui} />} />
        )}
      </ErrorBoundary>
    </div>
  );
}
