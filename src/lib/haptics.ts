import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Vibration feedback. Does nothing in a browser and never throws.
function run(fn: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
}

export const haptic = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** A heavy thump followed by a success buzz, for new records. */
  record: () => {
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    setTimeout(() => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 140);
  },
};
