import { Alert } from 'react-native';

import type { IconName } from '@/components/ui';

// In-app dialog cards. `confirm()` and `notify()` can be called from anywhere;
// <DialogHost /> (mounted once in the root layout) shows them. If no host is
// mounted (shouldn't happen), the system alert is used instead.

export type DialogTone = 'default' | 'danger' | 'success' | 'gold';

export type DialogOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  /** Leave out for a message with a single button. */
  cancelLabel?: string;
  tone?: DialogTone;
  icon?: IconName;
  /** Small stats shown in the card, e.g. duration and volume. */
  details?: { label: string; value: string }[];
  /** Highlighted line, e.g. "2 unticked sets will be removed." */
  note?: string;
  /** A list of rows, e.g. the records a set beat. */
  items?: { title: string; detail?: string; icon?: IconName }[];
  /** More buttons above the main ones; the dialog resolves with their `value`. */
  choices?: { label: string; value: string; icon?: IconName; primary?: boolean }[];
};

type Request = DialogOptions & { resolve: (result: boolean | string) => void };

let show: ((req: Request) => void) | null = null;

/** Called by DialogHost to receive dialogs. Returns an unsubscribe function. */
export function registerDialogHost(fn: (req: Request) => void): () => void {
  show = fn;
  return () => {
    if (show === fn) show = null;
  };
}

/** Asks a yes/no question. Resolves true when the user confirms. */
export function confirm(
  opts: Omit<DialogOptions, 'cancelLabel' | 'tone'> & {
    cancelLabel?: string;
    destructive?: boolean;
    tone?: DialogTone;
  },
): Promise<boolean> {
  const { destructive, ...rest } = opts;
  const options: DialogOptions = {
    cancelLabel: 'Cancel',
    tone: destructive ? 'danger' : 'default',
    ...rest,
  };
  return new Promise((resolve) => {
    if (show) {
      show({ ...options, resolve: (r) => resolve(r === true) });
      return;
    }
    Alert.alert(options.title, options.message, [
      { text: options.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: options.confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

/** Shows a message with a single button. */
export function notify(title: string, message?: string, icon?: IconName): Promise<void> {
  return new Promise((resolve) => {
    if (show) {
      show({ title, message, icon, confirmLabel: 'Got it', resolve: () => resolve() });
      return;
    }
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
  });
}

/** Shows a card with a single button (e.g. details about something). */
export function info(opts: Omit<DialogOptions, 'cancelLabel' | 'choices'>): Promise<void> {
  return new Promise((resolve) => {
    if (show) {
      show({ ...opts, resolve: () => resolve() });
      return;
    }
    Alert.alert(opts.title, opts.message, [{ text: opts.confirmLabel, onPress: () => resolve() }]);
  });
}

/**
 * Asks to pick one of several options. Resolves with the chosen option's value,
 * or null when the dialog is dismissed with the cancel button / Escape.
 */
export function choose(
  opts: Omit<DialogOptions, 'confirmLabel'> & { cancelLabel: string; choices: NonNullable<DialogOptions['choices']> },
): Promise<string | null> {
  return new Promise((resolve) => {
    if (show) {
      show({ ...opts, confirmLabel: '', resolve: (r) => resolve(typeof r === 'string' ? r : null) });
      return;
    }
    Alert.alert(opts.title, opts.message, [
      ...opts.choices.map((c) => ({ text: c.label, onPress: () => resolve(c.value) })),
      { text: opts.cancelLabel, style: 'cancel' as const, onPress: () => resolve(null) },
    ]);
  });
}
