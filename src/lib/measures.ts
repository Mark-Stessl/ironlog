import type { IconName } from '@/components/ui';

// Body measurements the user can log. Body weight is the main one.

export type MeasureKind = {
  key: string;
  label: string;
  unit: 'kg' | 'cm' | '%';
  icon: IconName;
  hint?: string;
};

export const WEIGHT: MeasureKind = {
  key: 'weight',
  label: 'Body weight',
  unit: 'kg',
  icon: 'scale-outline',
};

export const MEASURES: MeasureKind[] = [
  WEIGHT,
  { key: 'body_fat', label: 'Body fat', unit: '%', icon: 'water-outline' },
  { key: 'neck', label: 'Neck', unit: 'cm', icon: 'resize-outline' },
  { key: 'shoulders', label: 'Shoulders', unit: 'cm', icon: 'resize-outline' },
  { key: 'chest', label: 'Chest', unit: 'cm', icon: 'resize-outline' },
  {
    key: 'arms',
    label: 'Arms',
    unit: 'cm',
    icon: 'resize-outline',
    hint: 'Flexed, at the widest point',
  },
  { key: 'forearms', label: 'Forearms', unit: 'cm', icon: 'resize-outline' },
  {
    key: 'waist',
    label: 'Waist',
    unit: 'cm',
    icon: 'resize-outline',
    hint: 'At the belly button',
  },
  { key: 'hips', label: 'Hips', unit: 'cm', icon: 'resize-outline' },
  { key: 'thighs', label: 'Thighs', unit: 'cm', icon: 'resize-outline' },
  { key: 'calves', label: 'Calves', unit: 'cm', icon: 'resize-outline' },
];

export function measureKind(key: string): MeasureKind {
  return MEASURES.find((m) => m.key === key) ?? WEIGHT;
}

/** "82.4 kg", "15 %", "38 cm" */
export function fmtMeasure(value: number, unit: MeasureKind['unit']): string {
  const v = Math.round(value * 10) / 10;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return unit === '%' ? `${s} %` : `${s} ${unit}`;
}

/** "+0.4 kg", "−1.2 cm" */
export function fmtChange(diff: number, unit: MeasureKind['unit']): string {
  const v = Math.round(diff * 10) / 10;
  if (v === 0) return 'No change';
  return `${v > 0 ? '+' : '−'}${fmtMeasure(Math.abs(v), unit)}`;
}

/** Plausible range so a typo like 824 kg is caught. */
export function validMeasure(value: number, unit: MeasureKind['unit']): boolean {
  if (unit === 'kg') return value >= 20 && value <= 400;
  if (unit === '%') return value >= 1 && value <= 70;
  return value >= 5 && value <= 250;
}
