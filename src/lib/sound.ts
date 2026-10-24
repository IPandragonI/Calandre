/**
 * Tiny synthesised cues (no audio files to download or cache).
 * Created lazily on first use, which always follows a user gesture.
 */
export type SoundCue = "correct" | "wrong" | "close" | "finish";

let context: AudioContext | null = null;

const CUES: Record<SoundCue, { freq: number; at: number; dur: number }[]> = {
  correct: [
    { freq: 660, at: 0, dur: 0.09 },
    { freq: 990, at: 0.08, dur: 0.14 },
  ],
  wrong: [{ freq: 196, at: 0, dur: 0.18 }],
  close: [{ freq: 440, at: 0, dur: 0.08 }],
  finish: [
    { freq: 523, at: 0, dur: 0.1 },
    { freq: 659, at: 0.1, dur: 0.1 },
    { freq: 784, at: 0.2, dur: 0.22 },
  ],
};

export function playCue(cue: SoundCue): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    const ctx = context;
    if (ctx.state === "suspended") void ctx.resume();
    for (const note of CUES[cue]) {
      const start = ctx.currentTime + note.at;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cue === "wrong" ? "triangle" : "sine";
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + note.dur + 0.02);
    }
  } catch {
    // Audio is a nicety; never let it break the game.
  }
}
