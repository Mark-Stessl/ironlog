import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MACRO_COLOR } from '@/components/nutrition-charts';
import { Button, Card, Chip, Page, SectionTitle, text } from '@/components/ui';
import { latestMeasurements } from '@/lib/db';
import { getGoalSettings, goalsFrom, setGoalSettings, type GoalSettings } from '@/lib/food-db';
import { parseNum } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import {
  AIM_OPTIONS,
  computeGoals,
  PAL_OPTIONS,
  restingEnergy,
  type Aim,
  type BodyProfile,
  type Goals,
  type Sex,
} from '@/lib/nutrition';
import { C, F, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

const CUSTOM: { key: keyof Goals; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'waterMl', label: 'Water', unit: 'ml' },
];

export default function GoalsScreen() {
  const [data] = useFocusData(async (db) => ({
    settings: await getGoalSettings(db),
    weight: (await latestMeasurements(db)).weight?.value ?? null,
  }));
  if (!data) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return <GoalsForm initial={data.settings} weight={data.weight} />;
}

function GoalsForm({ initial, weight }: { initial: GoalSettings; weight: number | null }) {
  const db = useSQLiteContext();
  const p = initial.profile;
  const [sex, setSex] = useState<Sex>(p?.sex ?? 'male');
  const [age, setAge] = useState(p ? String(p.age) : '');
  const [height, setHeight] = useState(p ? String(p.heightCm) : '');
  const [kg, setKg] = useState(p ? String(p.weightKg) : weight ? String(weight) : '');
  const [pal, setPal] = useState(p?.pal ?? 1.6);
  const [aim, setAim] = useState<Aim>(p?.aim ?? 'maintain');
  const [proteinPerKg, setProteinPerKg] = useState(p?.proteinPerKg ?? 1.8);
  const [custom, setCustom] = useState<Partial<Record<keyof Goals, string>>>(
    Object.fromEntries(Object.entries(initial.custom).map(([k, v]) => [k, String(v)])),
  );
  const [showCustom, setShowCustom] = useState(Object.keys(initial.custom).length > 0);

  // Use the newest logged body weight if the profile has none yet.
  useEffect(() => {
    if (!kg && weight) setKg(String(weight));
  }, [weight, kg]);

  const profile: BodyProfile | null = (() => {
    const a = parseNum(age);
    const h = parseNum(height);
    const w = parseNum(kg);
    if (!a || !h || !w || a < 14 || a > 100 || h < 120 || h > 230 || w < 30 || w > 300) return null;
    return { sex, age: a, heightCm: h, weightKg: w, pal, aim, proteinPerKg };
  })();

  const customNums: Partial<Goals> = {};
  if (showCustom) {
    for (const [k, v] of Object.entries(custom) as [keyof Goals, string][]) {
      const n = parseNum(v ?? '');
      if (n) customNums[k] = Math.round(n);
    }
  }
  const settings: GoalSettings = { profile, custom: customNums };
  const goals = goalsFrom(settings);
  const calculated = computeGoals(profile);

  const save = async () => {
    await setGoalSettings(db, settings);
    haptic.success();
    router.back();
  };

  return (
    <Page maxWidth={640}>
      <Stack.Screen options={{ title: 'Nutrition goals' }} />
      <Text style={text.title}>Your daily goals</Text>
      <Text style={text.dim}>
        Fill in your body and how active you are. Without it, the EU reference intakes for an average adult are used
        (2000 kcal).
      </Text>

      <Animated.View entering={FadeIn} style={styles.result}>
        <View style={{ flex: 1 }}>
          <Text style={styles.big}>{goals.kcal.toLocaleString('en-US')}</Text>
          <Text style={text.faint}>kcal per day</Text>
        </View>
        {(['protein', 'carbs', 'fat'] as const).map((k) => (
          <View key={k} style={styles.macro}>
            <View style={[styles.dot, { backgroundColor: MACRO_COLOR[k] }]} />
            <Text style={styles.macroValue}>{goals[k]} g</Text>
            <Text style={text.faint}>{k === 'protein' ? 'Protein' : k === 'carbs' ? 'Carbs' : 'Fat'}</Text>
          </View>
        ))}
        <View style={styles.macro}>
          <View style={[styles.dot, { backgroundColor: C.accent }]} />
          <Text style={styles.macroValue}>{(goals.waterMl / 1000).toFixed(1)} L</Text>
          <Text style={text.faint}>Water</Text>
        </View>
      </Animated.View>

      <SectionTitle title="Body" />
      <Card style={{ gap: S.md }}>
        <View style={styles.row}>
          <Chip label="Male" active={sex === 'male'} onPress={() => setSex('male')} />
          <Chip label="Female" active={sex === 'female'} onPress={() => setSex('female')} />
        </View>
        <View style={styles.row}>
          <Field label="Age" value={age} onChange={setAge} unit="years" />
          <Field label="Height" value={height} onChange={setHeight} unit="cm" />
          <Field label="Weight" value={kg} onChange={setKg} unit="kg" />
        </View>
      </Card>

      <SectionTitle title="How active are you?" />
      <Card style={{ gap: 4, padding: 6 }}>
        {PAL_OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => setPal(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: pal === o.value }}
            style={[styles.option, pal === o.value && styles.optionOn]}>
            <View style={[styles.radio, pal === o.value && styles.radioOn]} />
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>{o.label}</Text>
              <Text style={text.faint}>{o.hint}</Text>
            </View>
            <Text style={text.faint}>PAL {o.value.toFixed(1)}</Text>
          </Pressable>
        ))}
      </Card>

      <SectionTitle title="Goal" />
      <View style={styles.row}>
        {AIM_OPTIONS.map((a) => (
          <Chip
            key={a.value}
            label={`${a.label}${a.kcal ? ` (${a.kcal > 0 ? '+' : '−'}${Math.abs(a.kcal)} kcal)` : ''}`}
            active={aim === a.value}
            onPress={() => setAim(a.value)}
          />
        ))}
      </View>

      <SectionTitle title="Protein" />
      <View style={styles.row}>
        {[1.4, 1.6, 1.8, 2.0].map((v) => (
          <Chip key={v} label={`${v.toFixed(1)} g/kg`} active={proteinPerKg === v} onPress={() => setProteinPerKg(v)} />
        ))}
      </View>
      <Text style={text.faint}>
        The ISSN recommends 1.4–2.0 g per kg body weight per day for people who train to build or keep muscle.
      </Text>

      {profile ? (
        <Card style={{ gap: 6 }}>
          <Text style={text.label}>How it's calculated</Text>
          <Text style={text.dim}>
            Resting energy {Math.round(restingEnergy(profile)).toLocaleString('en-US')} kcal (Henry equation, used by
            EFSA) × activity {profile.pal.toFixed(1)}
            {aim !== 'maintain' ? ` ${aim === 'lose' ? '−' : '+'} ${Math.abs(AIM_OPTIONS.find((a) => a.value === aim)!.kcal)} kcal` : ''} ={' '}
            {calculated.kcal.toLocaleString('en-US')} kcal.
          </Text>
          <Text style={text.dim}>
            Fat 30% of energy (EFSA: 20–35%), the rest from carbs. Water {(calculated.waterMl / 1000).toFixed(1)} L from
            drinks: EFSA recommends {sex === 'male' ? '2.5' : '2.0'} L in total, about 80% of it from drinks. Drink more on
            hot days and when you train.
          </Text>
        </Card>
      ) : (
        <Text style={text.faint}>Enter age, height and weight to calculate your own goals.</Text>
      )}

      <Pressable onPress={() => setShowCustom((s) => !s)} accessibilityRole="button">
        <SectionTitle
          title="Set your own numbers"
          right={<Text style={[text.faint, { color: C.accent }]}>{showCustom ? 'Hide' : 'Optional'}</Text>}
        />
      </Pressable>
      {showCustom ? (
        <Card style={styles.customGrid}>
          {CUSTOM.map((c) => (
            <Field
              key={c.key}
              label={c.label}
              value={custom[c.key] ?? ''}
              onChange={(t) => setCustom((v) => ({ ...v, [c.key]: t }))}
              unit={c.unit}
              placeholder={String(calculated[c.key])}
            />
          ))}
        </Card>
      ) : null}

      <Button label="Save goals" icon="checkmark" kind="primary" onPress={save} style={{ marginTop: S.md }} />
      <Text style={[text.faint, { marginTop: S.sm }]}>
        Sources: EU Regulation 1169/2011 (reference intakes), EFSA dietary reference values for energy, fat,
        carbohydrates, fibre and water, ISSN position stand on protein (2017). This is general guidance, not medical
        advice.
      </Text>
    </Page>
  );
}

function Field({
  label,
  value,
  onChange,
  unit,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  unit: string;
  placeholder?: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 90, gap: 4 }}>
      <Text style={text.faint}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={C.textFaint}
          accessibilityLabel={label}
          style={styles.fieldInput}
        />
        <Text style={text.faint}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    padding: S.lg,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
    marginTop: S.sm,
  },
  big: { color: C.text, fontFamily: F.display, fontSize: 30, letterSpacing: -0.8 },
  macro: { alignItems: 'center', minWidth: 50, gap: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  macroValue: { color: C.text, fontFamily: F.semi, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: R.md },
  optionOn: { backgroundColor: C.accentDim },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.borderHi },
  radioOn: { borderColor: C.accent, borderWidth: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.bg,
  },
  fieldInput: { flex: 1, minWidth: 0, color: C.text, fontFamily: F.semi, fontSize: 15, paddingVertical: 0 },
  customGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
});
