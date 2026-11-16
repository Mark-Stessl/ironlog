import { Alert, Platform } from 'react-native';

// React Native's Alert does nothing in a browser, so on web these fall back
// to the browser's own confirm/alert boxes.

/** Asks a yes/no question. Resolves true when the user confirms. */
export function confirm(opts: {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = opts.message ? `${opts.title}\n\n${opts.message}` : opts.title;
    return Promise.resolve(window.confirm(text));
  }
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: opts.confirmLabel,
          style: opts.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Shows a message with a single OK button. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
