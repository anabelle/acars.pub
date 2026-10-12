import type { Note } from "./tones";

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (context) return context;
  const Ctor: AudioContextCtor | undefined =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/**
 * Plays notes as soft sine tones with a quick attack and a long release
 * (S76). Synthesized, so there are no audio files to load. Silently does
 * nothing where Web Audio is missing or still locked.
 */
export function playNotes(notes: readonly Note[]): void {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  const now = ctx.currentTime + 0.02;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = note.freq;
    const t0 = now + note.start;
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(note.gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + note.duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + note.duration + 0.05);
  }
}
