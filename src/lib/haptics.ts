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
};
