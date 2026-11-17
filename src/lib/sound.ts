// Short sound effects (made by scripts/make-sounds.py). They mix with your music
// instead of pausing it, respect the iPhone silent switch, and can be turned off.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCES = {
  record: require('../../assets/sounds/record.wav'),
  rest: require('../../assets/sounds/rest.wav'),
  complete: require('../../assets/sounds/complete.wav'),
};

const VOLUME: Record<SoundName, number> = { record: 0.85, rest: 0.85, complete: 0.8 };

export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let enabled = true;
let volume = 0.7; // 0..1, the user's sound-effects volume
let modeSet = false;
const listeners = new Set<(on: boolean) => void>();

export const sound = {
  play(name: SoundName) {
    if (!enabled) return;
    try {
      if (!modeSet) {
        modeSet = true;
        setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(
          () => {},
        );
      }
      const player = (players[name] ??= createAudioPlayer(SOURCES[name]));
      // Squared so the slider feels even: half way sounds about half as loud.
      player.volume = VOLUME[name] * volume * volume;
      player.seekTo(0).catch(() => {});
      player.play();
    } catch {
      // Sound is a nice extra; never let it break the app.
    }
  },
  isEnabled: () => enabled,
  getVolume: () => volume,
  setVolume(v: number) {
    volume = Math.min(1, Math.max(0, v));
  },
  setEnabled(on: boolean) {
    enabled = on;
    listeners.forEach((fn) => fn(on));
  },
  /** Get notified when sound is switched on or off. Returns an unsubscribe function. */
  subscribe(fn: (on: boolean) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
