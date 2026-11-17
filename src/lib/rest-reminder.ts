// Rest-over reminder for the phone app: a local notification that fires when the
// rest timer ends, so it reaches you even if you're in another app.
// The browser version lives in rest-reminder.web.ts.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ReminderState = 'ask' | 'on' | 'off';

// While Ironlog is open, the in-app rest bar already shows "time for your next set",
// so the system banner is only needed when you're somewhere else.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let channel: Promise<unknown> | null = null;

async function allowed(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      channel ??= Notifications.setNotificationChannelAsync('rest', {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        sound: 'default',
      });
      await channel;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** On the phone the system asks for permission itself, so there is nothing to show. */
export function reminderState(): ReminderState {
  return 'on';
}

export async function askForReminders(): Promise<boolean> {
  return allowed();
}

/** Schedules the reminder. Returns a function that cancels it. */
export async function scheduleRestReminder(seconds: number, body: string): Promise<() => void> {
  if (!(await allowed())) return () => {};
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: "Rest's over", body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: 'rest',
      },
    });
    return () => {
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    };
  } catch {
    return () => {};
  }
}
