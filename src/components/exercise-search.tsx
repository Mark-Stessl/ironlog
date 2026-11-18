import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect, useRef, useState } from 'react';
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
import { Button, Chip, Empty, text } from '@/components/ui';
import type { Exercise } from '@/lib/db';
import { EQUIPMENT, MUSCLES } from '@/lib/exercise-data';
import { searchExercisesInfo } from '@/lib/search';
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
  onCreate,
  header,
  selectedId,
  pickIcon,
  padding = S.lg,
}: {
  exercises: Exercise[];
  onPick: (ex: Exercise) => void;
  autoFocus?: boolean;
  /** Offers to create a custom exercise (with the typed name) when it isn't in the list. */
  onCreate?: (query: string) => void;
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

  const { results, typo } = searchExercisesInfo(query, exercises, { muscle, equipment });
  // Focus the search field when asked; also after the screen's slide-in, when
  // browsers accept focus more reliably. (iPhone: see primeKeyboard.)
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const a = setTimeout(() => input.current?.focus(), 0);
    const b = setTimeout(() => input.current?.focus(), 350);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [autoFocus]);
  const filtering = query.trim() !== '' || muscle != null || equipment != null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: padding, paddingTop: padding, gap: S.sm }}>
        {header}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={15} color={C.textFaint} />
          <TextInput
            ref={input}
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
          typo ? (
            <View style={styles.typo}>
              <Ionicons name="sparkles-outline" size={14} color={C.accent} />
              <Text style={[text.dim, { flex: 1 }]}>
                No exact match for "{query.trim()}". Showing the closest spellings.
              </Text>
            </View>
          ) : (
            <Text style={[text.label, { marginTop: S.sm, marginBottom: 6, marginLeft: S.sm }]}>
              {filtering ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : 'Most used first'}
            </Text>
          )
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
          onCreate && query.trim() ? (
            <View style={styles.createCard}>
              <Ionicons name="construct-outline" size={20} color={C.accent} />
              <Text style={[text.strong, { textAlign: 'center' }]}>No "{query.trim()}" yet</Text>
              <Text style={[text.faint, { textAlign: 'center' }]}>
                Your gym has a machine that's not in the list? Add it and it works like any other exercise.
              </Text>
              <Button
                label={`Create "${query.trim()}"`}
                icon="add"
                kind="primary"
                small
                onPress={() => onCreate(query.trim())}
                style={{ marginTop: 6 }}
              />
            </View>
          ) : (
            <Empty icon="search" title="No exercise found" hint="Check the spelling or remove a filter." />
          )
        }
        ListFooterComponent={
          onCreate && results.length > 0 ? (
            <Pressable
              onPress={() => onCreate(query.trim())}
              style={(s: PressState) => [styles.createRow, (s.hovered || s.pressed) && { borderColor: C.accentLine }]}>
              <View style={styles.createIcon}>
                <Ionicons name="add" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowName}>
                  {query.trim() ? `Create "${query.trim()}"` : 'Create your own exercise'}
                </Text>
                <Text style={styles.rowMeta}>Missing a machine? Add it yourself.</Text>
              </View>
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  typo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginTop: S.sm,
    marginBottom: 6,
    marginHorizontal: S.sm,
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
  },
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
  createCard: {
    alignItems: 'center',
    gap: 6,
    marginTop: S.md,
    marginHorizontal: S.sm,
    padding: S.lg,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.accentLine,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    marginTop: S.sm,
    paddingVertical: 8,
    paddingHorizontal: S.sm,
    borderRadius: R.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
  },
  createIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { color: C.text, fontSize: 13, fontFamily: F.medium },
  rowMeta: { color: C.textFaint, fontSize: 12, fontFamily: F.regular, marginTop: 1 },
});
