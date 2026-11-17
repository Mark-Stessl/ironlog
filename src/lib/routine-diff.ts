// Compares what a routine planned with what you actually did. Pure functions,
// tested in tests/logic.test.ts.

export type PlanItem = { exercise_id: number; name: string; sets: number };

export type RoutineDiff = {
  added: string[];
  removed: string[];
  sets: { name: string; from: number; to: number }[];
  reordered: boolean;
};

export function diffRoutine(plan: PlanItem[], done: PlanItem[]): RoutineDiff {
  const remaining = [...plan];
  const matched: { plan: PlanItem; done: PlanItem }[] = [];
  const added: string[] = [];
  for (const d of done) {
    const i = remaining.findIndex((p) => p.exercise_id === d.exercise_id);
    if (i === -1) added.push(d.name);
    else matched.push({ plan: remaining.splice(i, 1)[0], done: d });
  }
  const sets = matched.filter((m) => m.plan.sets !== m.done.sets).map((m) => ({ name: m.done.name, from: m.plan.sets, to: m.done.sets }));
  // Same exercises kept, but in a different order?
  const planOrder = plan.filter((p) => matched.some((m) => m.plan === p));
  const reordered = matched.some((m, i) => planOrder[i] !== m.plan);
  return { added, removed: remaining.map((p) => p.name), sets, reordered };
}

export function hasChanges(d: RoutineDiff): boolean {
  return d.added.length > 0 || d.removed.length > 0 || d.sets.length > 0 || d.reordered;
}

/** Short human-readable lines, e.g. "Added Lat Pulldown". */
export function describeDiff(d: RoutineDiff): { kind: 'added' | 'removed' | 'sets' | 'order'; text: string }[] {
  return [
    ...d.added.map((n) => ({ kind: 'added' as const, text: `Added ${n}` })),
    ...d.removed.map((n) => ({ kind: 'removed' as const, text: `Removed ${n}` })),
    ...d.sets.map((s) => ({ kind: 'sets' as const, text: `${s.name}: ${s.from} → ${s.to} sets` })),
    ...(d.reordered ? [{ kind: 'order' as const, text: 'Changed the order of exercises' }] : []),
  ];
}
