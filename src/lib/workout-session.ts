// State shared by the workout list and focus mode while a workout is running:
// the rest timer (so a break keeps counting when you switch views) and a way for
// focus mode to ask the workout screen to finish.
import { useSyncExternalStore } from 'react';

export type Rest = { id: number; endAt: number; total: number; label?: string };

let rest: Rest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRest() {
  return rest;
}

export function setRest(next: Rest | null) {
  rest = next;
  emit();
}

/** The running rest timer, the same in every view. */
export function useRest(): [Rest | null, (r: Rest | null) => void] {
  return [useSyncExternalStore(subscribe, getRest, getRest), setRest];
}

/** Starts a break of `seconds` for `label`. */
export function startRest(seconds: number, label?: string) {
  setRest({ id: Date.now(), endAt: Date.now() + seconds * 1000, total: seconds * 1000, label });
}

/** Moves the end of the running break (±15 s buttons). */
export function adjustRest(deltaMs: number) {
  if (!rest) return;
  setRest({ ...rest, endAt: rest.endAt + deltaMs, total: Math.max(rest.total + deltaMs, 1000) });
}

// Focus mode → workout screen: "please finish the workout" (shows the normal finish dialog).
let finishWanted = false;
export function requestFinish() {
  finishWanted = true;
  emit();
}
export function takeFinishRequest() {
  const was = finishWanted;
  finishWanted = false;
  return was;
}
