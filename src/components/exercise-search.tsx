import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableStateCallbackType,
} from 'react-native';

import { ExerciseImage } from '@/components/exercise-image';
import { Chip, Empty, text } from '@/components/ui';
import type { Exercise } from '@/lib/db';
import { EQUIPMENT, MUSCLES } from '@/lib/exercise-data';
import { searchExercises } from '@/lib/search';
import { C, F, R, S } from '@/lib/theme';

type PressState = PressableStateCallbackType & { hovered?: boolean };

/**
 * Search box + filter chips + suggestion list.
 * Suggestions update on every keystroke; exercises you use often rank higher.
 */
export function ExerciseSearch({
  exercises,
  onPick,
  autoFocus,
  footer,
  header,
  selectedId,
  pickIcon,
  padding = S.lg,
}: {
  exercises: Exercise[];
  onPick: (ex: Exercise) => void;
  autoFocus?: boolean;
  /** Rendered under the results, gets the current query (e.g. "Create ..." row). */
  footer?: (query: string) => ReactNode;
  /** Rendered above the search box (e.g. a page title). */
  header?: ReactNode;
  /** Highlights a row (desktop list + detail view). */
  selectedId?: number | null;
  /** Shows an icon at the end of each row, e.g. "add". */
  pickIcon?: 'add';
  padding?: number;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  const results = searchExercises(query, exercises, { muscle, equipment });
  const filtering = query.trim() !== '' || muscle != null || equipment != null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: padding, paddingTop: padding, gap: S.sm }}>
        {header}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={15} color={C.textFaint} />
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
              <Ionicons name="close-circle" size={16} color={C.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={[styles.chips, { paddingHorizontal: padding }]}
        keyboardShouldPersistTaps="handled">
        {MUSCLES.map((m) => (
          <Chip key={m} label={m} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
        ))}
        <View style={styles.chipDivider} />
        {EQUIPMENT.map((e) => (
          <Chip key={e} label={e} active={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} />
        ))}
      </ScrollView>

      <FlatList
        data={results}
        keyExtractor={(ex) => String(ex.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: padding - S.sm, paddingBottom: S.xxl }}
        ListHeaderComponent={
          <Text style={[text.label, { marginTop: S.sm, marginBottom: 6, marginLeft: S.sm }]}>
            {filtering ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : 'Most used first'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item)}
            style={(s: PressState) => [
              styles.row,
              (s.hovered || s.pressed) && { backgroundColor: C.card },
              selectedId === item.id && { backgroundColor: C.accentDim },
            ]}>
            <ExerciseImage name={item.name} equipment={item.equipment} size={38} radius={8} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {item.muscle} · {item.equipment}
                {item.is_custom ? ' · Custom' : ''}
                {item.use_count > 0 ? ` · ${item.use_count}×` : ''}
              </Text>
            </View>
            {pickIcon ? <Ionicons name="add" size={18} color={C.accent} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <Empty icon="search" title="No exercise found" hint="Check the spelling or remove a filter." />
        }
        ListFooterComponent={
          footer ? <View style={{ paddingHorizontal: S.sm }}>{footer(query.trim())}</View> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingHorizontal: S.md,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 13, fontFamily: F.regular, paddingVertical: 0 },
  chips: { gap: 6, paddingVertical: S.sm, alignItems: 'center' },
  chipDivider: { width: 1, height: 16, backgroundColor: C.border, marginHorizontal: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: 7,
    paddingHorizontal: S.sm,
    borderRadius: R.md,
  },
  rowName: { color: C.text, fontSize: 13, fontFamily: F.medium },
  rowMeta: { color: C.textFaint, fontSize: 12, fontFamily: F.regular, marginTop: 1 },
});
