import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip, Empty } from '@/components/ui';
import type { Exercise } from '@/lib/db';
import { EQUIPMENT, MUSCLES } from '@/lib/exercise-data';
import { searchExercises } from '@/lib/search';
import { C, R, S } from '@/lib/theme';

/**
 * Search box + filter chips + suggestion list.
 * Suggestions update on every keystroke; exercises you use often rank higher.
 */
export function ExerciseSearch({
  exercises,
  onPick,
  autoFocus,
  footer,
}: {
  exercises: Exercise[];
  onPick: (ex: Exercise) => void;
  autoFocus?: boolean;
  /** Rendered under the results, gets the current query (e.g. "Create ..." row). */
  footer?: (query: string) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  const results = searchExercises(query, exercises, { muscle, equipment });
  const filtering = query.trim() !== '' || muscle != null || equipment != null;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={C.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search machine, exercise or muscle"
          placeholderTextColor={C.textFaint}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.searchInput}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={C.textDim} />
          </Pressable>
        ) : null}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {MUSCLES.map((m) => (
            <Chip key={m} label={m} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {EQUIPMENT.map((e) => (
            <Chip key={e} label={e} active={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(ex) => String(ex.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: S.xxl }}
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            {filtering ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : 'Most used first'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.cardHi }]}>
            <View style={styles.rowIcon}>
              <Ionicons name={iconFor(item.equipment)} size={18} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.muscle} · {item.equipment}
                {item.is_custom ? ' · Custom' : ''}
              </Text>
            </View>
            {item.use_count > 0 ? <Text style={styles.rowCount}>{item.use_count}×</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={<Empty icon="search" title="No exercise found" hint="Check the spelling or remove a filter." />}
        ListFooterComponent={footer ? <>{footer(query.trim())}</> : undefined}
      />
    </View>
  );
}

function iconFor(equipment: string) {
  switch (equipment) {
    case 'Machine':
    case 'Smith Machine':
      return 'hardware-chip-outline' as const;
    case 'Cable':
      return 'git-pull-request-outline' as const;
    case 'Bodyweight':
      return 'body-outline' as const;
    default:
      return 'barbell-outline' as const;
  }
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    margin: S.lg,
    marginBottom: S.sm,
    paddingHorizontal: S.md,
    height: 46,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 0 },
  chips: { paddingHorizontal: S.lg, gap: S.sm, paddingVertical: S.xs },
  listHeader: { color: C.textFaint, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: S.md, marginBottom: S.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: S.md,
    paddingHorizontal: S.sm,
    borderRadius: R.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { color: C.text, fontSize: 16, fontWeight: '600' },
  rowMeta: { color: C.textDim, fontSize: 13, marginTop: 2 },
  rowCount: { color: C.textFaint, fontSize: 13, fontWeight: '700' },
});
