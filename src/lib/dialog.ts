import { Alert } from 'react-native';

import type { IconName } from '@/components/ui';

// In-app dialog cards. `confirm()` and `notify()` can be called from anywhere;
// <DialogHost /> (mounted once in the root layout) shows them. If no host is
// mounted (shouldn't happen), the system alert is used instead.

export type DialogTone = 'default' | 'danger' | 'success';

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
};

type Request = DialogOptions & { resolve: (ok: boolean) => void };

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
  opts: Omit<DialogOptions, 'cancelLabel' | 'tone'> & { cancelLabel?: string; destructive?: boolean; tone?: DialogTone },
): Promise<boolean> {
  const { destructive, ...rest } = opts;
  const options: DialogOptions = {
    cancelLabel: 'Cancel',
    tone: destructive ? 'danger' : 'default',
    ...rest,
  };
  return new Promise((resolve) => {
    if (show) {
      show({ ...options, resolve });
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
