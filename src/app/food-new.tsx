import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PhotoField } from '@/components/photo-field';
import { Button, Card, Page, SectionTitle, text } from '@/components/ui';
import { notify } from '@/lib/dialog';
import { createCustomFood } from '@/lib/food-db';
import { parseNum } from '@/lib/format';
import { kcalFromMacros, MICROS, NUTRIENTS, type NutrientKey, type Nutrients } from '@/lib/nutrition';
import { C, F, R, S } from '@/lib/theme';

const MAIN: { key: NutrientKey; indent?: boolean; required?: boolean }[] = [
  { key: 'kcal' },
  { key: 'fat', required: true },
  { key: 'satFat', indent: true },
  { key: 'carbs', required: true },
  { key: 'sugar', indent: true },
  { key: 'fiber' },
  { key: 'protein', required: true },
  { key: 'salt' },
];

export default function NewFoodScreen() {
  const p = useLocalSearchParams<{ barcode?: string; name?: string; meal?: string; day?: string }>();
  const db = useSQLiteContext();
  const [name, setName] = useState(p.name ?? '');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(p.barcode ?? '');
  const [servingLabel, setServingLabel] = useState('');
  const [servingG, setServingG] = useState('');
  const [values, setValues] = useState<Partial<Record<NutrientKey, string>>>({});
  const [more, setMore] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const per100: Nutrients = {};
  for (const [k, v] of Object.entries(values) as [NutrientKey, string][]) {
    const n = parseNum(v ?? '');
    if (n != null) per100[k] = n;
  }
  const kcal = per100.kcal ?? (per100.protein != null || per100.carbs != null || per100.fat != null ? Math.round(kcalFromMacros(per100)) : null);

  const save = async () => {
    if (!name.trim()) return notify('Name it', 'Give the food a name so you can find it again.', 'create-outline');
    if (per100.protein == null || per100.carbs == null || per100.fat == null)
      return notify('Protein, carbs and fat', 'Fill in at least these three from the label (per 100 g).', 'nutrition-outline');
    const g = parseNum(servingG);
    const ref = await createCustomFood(db, {
      name,
      brand,
      barcode: barcode.trim() || null,
      per100: { ...per100, kcal: kcal ?? 0 },
      serving: g ? { label: servingLabel.trim() || '1 serving', g } : null,
      image: photo,
    });
    router.replace({ pathname: '/food/[ref]', params: { ref, meal: p.meal ?? '', day: p.day ?? '' } });
  };

  const field = (key: NutrientKey, indent?: boolean, last?: boolean) => (
    <View key={key} style={[styles.nutRow, !last && styles.line]}>
      <Text style={[indent ? text.dim : text.body, { flex: 1, paddingLeft: indent ? S.md : 0 }]}>
        {indent ? `of which ${NUTRIENTS[key].label.toLowerCase()}` : NUTRIENTS[key].label}
      </Text>
      <TextInput
        value={values[key] ?? ''}
        onChangeText={(t) => setValues((v) => ({ ...v, [key]: t }))}
        placeholder={key === 'kcal' && kcal != null ? String(kcal) : '0'}
        placeholderTextColor={C.textFaint}
        keyboardType="decimal-pad"
        accessibilityLabel={`${NUTRIENTS[key].label} per 100 g`}
        style={styles.nutInput}
      />
      <Text style={styles.unit}>{NUTRIENTS[key].unit}</Text>
    </View>
  );

  return (
    <Page maxWidth={620}>
      <Stack.Screen options={{ title: 'New food' }} />
      <Text style={text.dim}>Copy the nutrition table from the package. Values are per 100 g (or 100 ml).</Text>

      <Card style={{ gap: S.md }}>
        <Input label="Name" value={name} onChange={setName} placeholder="e.g. Protein pudding chocolate" autoFocus={!name} />
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <Input label="Brand" value={brand} onChange={setBrand} placeholder="Optional" style={{ flex: 1 }} />
          <Input
            label="Barcode"
            value={barcode}
            onChange={(t) => setBarcode(t.replace(/\D/g, ''))}
            placeholder="Optional"
            numeric
            style={{ flex: 1 }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <Input label="Serving" value={servingLabel} onChange={setServingLabel} placeholder="1 cup" style={{ flex: 1.4 }} />
          <Input label="Grams per serving" value={servingG} onChange={setServingG} placeholder="200" numeric style={{ flex: 1 }} />
        </View>
      </Card>

      <PhotoField value={photo} onChange={setPhoto} />

      <SectionTitle title="Per 100 g" />
      <Card style={{ paddingVertical: 4 }}>{MAIN.map((m, i) => field(m.key, m.indent, i === MAIN.length - 1))}</Card>
      {kcal != null && values.kcal == null ? (
        <Text style={text.faint}>Calories left empty: {kcal} kcal is calculated from protein, carbs and fat.</Text>
      ) : null}

      <Pressable onPress={() => setMore((m) => !m)} accessibilityRole="button">
        <SectionTitle
          title="Vitamins and minerals"
          right={<Text style={[text.faint, { color: C.accent }]}>{more ? 'Hide' : 'Add (optional)'}</Text>}
        />
      </Pressable>
      {more ? (
        <Card style={{ paddingVertical: 4 }}>{MICROS.map((k, i) => field(k, false, i === MICROS.length - 1))}</Card>
      ) : null}

      <Button label="Save food" icon="checkmark" kind="primary" onPress={save} style={{ marginTop: S.md }} />
    </Page>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  autoFocus,
  style,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  numeric?: boolean;
  autoFocus?: boolean;
  style?: object;
}) {
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={text.faint}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textFaint}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        autoFocus={autoFocus}
        accessibilityLabel={label}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 40,
    paddingHorizontal: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: F.medium,
    fontSize: 14,
  },
  nutRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 6 },
  line: { borderBottomWidth: 1, borderBottomColor: C.border },
  nutInput: {
    width: 84,
    height: 34,
    paddingHorizontal: S.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: F.medium,
    fontSize: 14,
    textAlign: 'right',
  },
  unit: { width: 32, color: C.textFaint, fontFamily: F.medium, fontSize: 12 },
});
