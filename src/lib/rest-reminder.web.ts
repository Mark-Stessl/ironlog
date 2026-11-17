// Rest-over reminder for the browser version. Browsers can only notify while the
// page is still running in the background: this works on desktop and in Chrome on
// Android, but iPhones pause web pages in the background, so there it can't fire.
import type { ReminderState } from './rest-reminder';

export type { ReminderState };

const APP_TITLE = 'Ironlog';

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

let worker: Promise<ServiceWorkerRegistration | undefined> | null = null;

/** A tiny service worker lets Chrome on Android show notifications. */
function registerWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(undefined);
  const base = window.location.pathname.startsWith('/ironlog') ? '/ironlog/' : '/';
  worker ??= navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => undefined);
  return worker;
}

export function reminderState(): ReminderState {
  if (!supported()) return 'off';
  if (Notification.permission === 'granted') return 'on';
  if (Notification.permission === 'denied') return 'off';
  return 'ask';
}

/** Must be called from a tap or click. */
export async function askForReminders(): Promise<boolean> {
  if (!supported()) return false;
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') registerWorker();
    return result === 'granted';
  } catch {
    return false;
  }
}

async function show(body: string) {
  try {
    const reg = await registerWorker();
    if (reg) {
      await reg.showNotification("Rest's over", { body, tag: 'ironlog-rest' });
    } else {
      new Notification("Rest's over", { body, tag: 'ironlog-rest' });
    }
  } catch {
    // Not allowed here; the tab title below still helps on desktop.
  }
}

/** Schedules the reminder. Returns a function that cancels it. */
export async function scheduleRestReminder(seconds: number, body: string): Promise<() => void> {
  if (typeof document === 'undefined') return () => {};
  if (reminderState() === 'on') registerWorker();

  const timer = setTimeout(() => {
    if (document.visibilityState === 'visible') return; // the in-app bar handles it
    if (reminderState() === 'on') show(body);
    // Also flag the browser tab, in case notifications are off.
    const before = document.title;
    document.title = `Rest's over · ${APP_TITLE}`;
    const restore = () => {
      if (document.visibilityState === 'visible') {
        document.title = before;
        document.removeEventListener('visibilitychange', restore);
      }
    };
    document.addEventListener('visibilitychange', restore);
  }, seconds * 1000);

  return () => clearTimeout(timer);
}
