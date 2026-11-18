import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { SoundToggle } from '@/components/sound-toggle';
import { Card, ListCard, ListRow, Page, PageHeader, SectionTitle, text, type IconName } from '@/components/ui';
import {
  backupAge,
  backupDue,
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  summarize,
  type BackupSummary,
} from '@/lib/backup';
import { pickBackupFile, saveBackupFile } from '@/lib/backup-file';
import { getSetting, setSetting } from '@/lib/db';
import { confirm, notify } from '@/lib/dialog';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { C, F, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

/** "13 workouts, 9 days of food, 2 photos": only what's there. */
const describe = (s: BackupSummary) => {
  const parts = [
    [s.workouts, 'workout', 'workouts'],
    [s.foodDays, 'day of food', 'days of food'],
    [s.measurements, 'measurement', 'measurements'],
    [s.recipes, 'own recipe', 'own recipes'],
    [s.photos, 'photo', 'photos'],
  ] as const;
  const list = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  return list.length ? list.join(', ') : 'nothing logged yet';
};

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState<'save' | 'restore' | null>(null);
  const [data, reload] = useFocusData(async (d) => {
    const at = Number(await getSetting(d, 'last_backup', '0')) || null;
    const now = summarize(await createBackup(d));
    return { at, now };
  });

  const save = async () => {
    setBusy('save');
    try {
      const backup = await createBackup(db);
      const done = await saveBackupFile(backupFileName(), JSON.stringify(backup));
      if (done) {
        await setSetting(db, 'last_backup', String(Date.now()));
        haptic.success();
        sound.play('saved');
        reload();
      }
    } catch (e) {
      await notify("The backup couldn't be saved", (e as Error).message, 'alert-circle-outline');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const json = await pickBackupFile();
      if (json == null) return;
      const version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
      const backup = parseBackup(json, version);
      const when = new Date(backup.exportedAt).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const ok = await confirm({
        title: 'Restore this backup?',
        message: `From ${when}: ${describe(summarize(backup))}.\n\nEverything in the app now is replaced by the backup. Save a backup of the current state first if you might want it back.`,
        confirmLabel: 'Restore',
        icon: 'cloud-download-outline',
        destructive: true,
      });
      if (!ok) return;
      await restoreBackup(db, backup);
      haptic.success();
      await notify('Backup restored', 'Ironlog restarts with your restored data.', 'checkmark-circle');
      // Start fresh so every screen and setting reads the restored data.
      if (Platform.OS === 'web') window.location.assign(window.location.pathname.replace(/settings\/?$/, ''));
      else router.replace('/');
    } catch (e) {
      await notify("That didn't work", (e as Error).message, 'alert-circle-outline');
    } finally {
      setBusy(null);
    }
  };

  const due = data ? backupDue(data.at) : false;

  return (
    <Page maxWidth={640}>
      <PageHeader title="Settings" />

      <View>
        <SectionTitle title="Backup" />
        <Card style={{ gap: S.md }}>
          <View style={styles.backupHead}>
            <View style={[styles.backupIcon, due && styles.backupIconDue]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={due ? C.gold : C.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={text.strong}>{data ? backupAge(data.at) : ' '}</Text>
              <Text style={text.faint}>{data ? `In the app now: ${describe(data.now)}` : ' '}</Text>
            </View>
          </View>
          <Text style={text.dim}>
            Everything is stored only on this device. A backup is one file with all your workouts, food, measurements,
            recipes, photos and settings. Keep it in iCloud Drive or Files: if your phone is lost or reset, or the app
            gets removed, you can bring everything back.
          </Text>
          {due && data && (data.now.workouts || data.now.foodDays) ? (
            <Animated.View entering={FadeIn} style={styles.due}>
              <Ionicons name="alert-circle" size={15} color={C.gold} />
              <Text style={[text.dim, { flex: 1, color: C.text }]}>
                {data.at ? 'Your last backup is more than two weeks old.' : "You haven't saved a backup yet."}
              </Text>
            </Animated.View>
          ) : null}
          <Action
            icon="cloud-upload-outline"
            label="Save backup"
            sub={Platform.OS === 'web' ? 'On iPhone: Save to Files → iCloud Drive' : 'Choose where to keep it'}
            primary
            busy={busy === 'save'}
            onPress={save}
          />
          <Action
            icon="cloud-download-outline"
            label="Restore from a backup"
            sub="Pick an ironlog-backup file"
            busy={busy === 'restore'}
            onPress={restore}
          />
        </Card>
      </View>

      <View>
        <SectionTitle title="App" />
        <ListCard>
          <ListRow>
            <RowIcon icon="volume-medium-outline" />
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>Sounds</Text>
              <Text style={text.faint}>On or off, volume, and a preview of each sound</Text>
            </View>
            <SoundToggle framed size={20} />
          </ListRow>
          <LinkRow
            icon="flame-outline"
            label="Nutrition goals"
            sub="Calories, protein, water, body profile"
            href="/nutrition-goals"
          />
          <LinkRow icon="body-outline" label="Measures" sub="Weight, trend and calorie check" href="/measures" />
          <LinkRow icon="calendar-outline" label="Calendar" sub="Workouts, rest days and food" href="/calendar" last />
        </ListCard>
      </View>

      <View>
        <SectionTitle title="About" />
        <Card style={{ gap: S.sm }}>
          <Text style={text.strong}>Ironlog {Constants.expoConfig?.version ?? ''}</Text>
          <Text style={text.faint}>
            No account, no tracking. Your data stays on this device. Online only: barcodes and product searches go to
            Open Food Facts, exercise pictures load from RepDB, and links you tap open their sites.
          </Text>
          <Text style={text.faint}>
            Food data: Bundeslebensmittelschlüssel 4.0 (Max Rubner-Institut, CC BY 4.0) and Open Food Facts (ODbL).
            Exercise data: RepDB. Recipe photos: Unsplash.
          </Text>
        </Card>
      </View>
    </Page>
  );
}

function RowIcon({ icon }: { icon: IconName }) {
  return (
    <View style={styles.rowIcon}>
      <Ionicons name={icon} size={17} color={C.textDim} />
    </View>
  );
}

function LinkRow({
  icon,
  label,
  sub,
  href,
  last,
}: {
  icon: IconName;
  label: string;
  sub: string;
  href: Href;
  last?: boolean;
}) {
  return (
    <ListRow onPress={() => router.push(href)} last={last}>
      <RowIcon icon={icon} />
      <View style={{ flex: 1 }}>
        <Text style={text.strong}>{label}</Text>
        <Text style={text.faint}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
    </ListRow>
  );
}

function Action({
  icon,
  label,
  sub,
  primary,
  busy,
  onPress,
}: {
  icon: IconName;
  label: string;
  sub: string;
  primary?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionSecondary,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}>
      {busy ? (
        <ActivityIndicator color={primary ? C.onAccent : C.accent} />
      ) : (
        <Ionicons name={icon} size={20} color={primary ? C.onAccent : C.accent} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, primary && { color: C.onAccent }]}>{label}</Text>
        <Text style={[styles.actionSub, primary && { color: C.onAccent, opacity: 0.75 }]}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backupHead: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  backupIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentLine,
  },
  backupIconDue: { backgroundColor: 'rgba(233, 190, 88, 0.12)', borderColor: 'rgba(233, 190, 88, 0.45)' },
  due: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: 'rgba(233, 190, 88, 0.45)',
    backgroundColor: 'rgba(233, 190, 88, 0.08)',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: 58,
    paddingHorizontal: S.lg,
    borderRadius: R.lg,
  },
  actionPrimary: { backgroundColor: C.accent },
  actionSecondary: { borderWidth: 1, borderColor: C.accentLine, backgroundColor: C.accentDim },
  actionLabel: { color: C.text, fontFamily: F.semi, fontSize: 15 },
  actionSub: { color: C.textFaint, fontFamily: F.regular, fontSize: 12, marginTop: 1 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardHi,
  },
});
