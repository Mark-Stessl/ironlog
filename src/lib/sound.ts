// Short sound effects (made by scripts/make-sounds.py). They mix with your music
// instead of pausing it, respect the iPhone silent switch, and can be turned off.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCES = {
  tick: require('../../assets/sounds/tick.wav'),
  record: require('../../assets/sounds/record.wav'),
  rest: require('../../assets/sounds/rest.wav'),
  complete: require('../../assets/sounds/complete.wav'),
};

const VOLUME: Record<SoundName, number> = { tick: 0.45, record: 0.8, rest: 0.8, complete: 0.75 };

export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let enabled = true;
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
      player.volume = VOLUME[name];
      player.seekTo(0).catch(() => {});
      player.play();
    } catch {
      // Sound is a nice extra; never let it break the app.
    }
  },
  isEnabled: () => enabled,
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
