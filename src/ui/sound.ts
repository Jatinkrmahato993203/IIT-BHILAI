/** Tiny synthesized sounds (original, no audio files). Silent unless enabled and allowed. */
let ctx: AudioContext | null = null;

export type SoundName = 'ding' | 'error' | 'startup' | 'crash' | 'modem';

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const seq: Record<SoundName, [number, number][]> = {
      ding: [[880, 0.12]],
      error: [[220, 0.18]],
      startup: [[392, 0.18], [523, 0.18], [659, 0.18], [784, 0.4]],
      crash: [[110, 0.5]],
      modem: [[1200, 0.15], [2100, 0.15], [980, 0.2], [1650, 0.3]],
    };
    let t = ctx.currentTime;
    for (const [freq, dur] of seq[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = name === 'modem' ? 'square' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur * 0.9;
    }
  } catch {
    /* audio is optional */
  }
}
