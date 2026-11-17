// Which areas of the body map an exercise lights up. Pure functions, tested in
// tests/logic.test.ts.
import { getMedia } from './exercise-media';

/** Drawable areas of the body map (see components/body-map.tsx). */
export type Region =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'serratus'
  | 'traps'
  | 'upperBack'
  | 'rotatorCuff'
  | 'lats'
  | 'lowerBack'
  | 'hipFlexors'
  | 'glutes'
  | 'sideGlutes'
  | 'adductors'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'shins';

/** RepDB muscle name -> body map area and a short readable name. */
const DETAILED: Record<string, { region: Region; label: string }> = {
  pectoralis_major: { region: 'chest', label: 'Chest' },
  anterior_deltoid: { region: 'frontDelts', label: 'Front delts' },
  lateral_deltoid: { region: 'sideDelts', label: 'Side delts' },
  posterior_deltoid: { region: 'rearDelts', label: 'Rear delts' },
  biceps_brachii: { region: 'biceps', label: 'Biceps' },
  brachialis: { region: 'biceps', label: 'Brachialis' },
  brachioradialis: { region: 'forearms', label: 'Forearms' },
  forearm_flexors: { region: 'forearms', label: 'Forearms' },
  forearm_extensors: { region: 'forearms', label: 'Forearms' },
  forearms: { region: 'forearms', label: 'Forearms' },
  triceps_brachii: { region: 'triceps', label: 'Triceps' },
  rectus_abdominis: { region: 'abs', label: 'Abs' },
  transverse_abdominis: { region: 'abs', label: 'Deep core' },
  obliques: { region: 'obliques', label: 'Obliques' },
  serratus_anterior: { region: 'serratus', label: 'Serratus' },
  trapezius: { region: 'traps', label: 'Traps' },
  rhomboids: { region: 'upperBack', label: 'Upper back' },
  infraspinatus_teres_minor: { region: 'rotatorCuff', label: 'Rotator cuff' },
  supraspinatus: { region: 'rotatorCuff', label: 'Rotator cuff' },
  latissimus_dorsi: { region: 'lats', label: 'Lats' },
  erector_spinae: { region: 'lowerBack', label: 'Lower back' },
  quadratus_lumborum: { region: 'lowerBack', label: 'Lower back' },
  hip_flexors: { region: 'hipFlexors', label: 'Hip flexors' },
  gluteus_maximus: { region: 'glutes', label: 'Glutes' },
  gluteus_medius: { region: 'sideGlutes', label: 'Side glutes' },
  abductors: { region: 'sideGlutes', label: 'Outer hips' },
  adductors: { region: 'adductors', label: 'Inner thighs' },
  quadriceps: { region: 'quads', label: 'Quads' },
  hamstrings: { region: 'hamstrings', label: 'Hamstrings' },
  gastrocnemius: { region: 'calves', label: 'Calves' },
  soleus: { region: 'calves', label: 'Calves' },
  tibialis_anterior: { region: 'shins', label: 'Shins' },
};

/** The app's muscle groups (used by custom exercises) -> body map areas. */
const GROUPS: Record<string, Region[]> = {
  Chest: ['chest'],
  Back: ['lats', 'upperBack', 'traps'],
  Shoulders: ['frontDelts', 'sideDelts', 'rearDelts'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Forearms: ['forearms'],
  Quads: ['quads'],
  Hamstrings: ['hamstrings'],
  Glutes: ['glutes'],
  Calves: ['calves'],
  Core: ['abs', 'obliques'],
};

export type MuscleMap = {
  primary: Region[];
  secondary: Region[];
  primaryLabels: string[];
  secondaryLabels: string[];
};

const unique = <T,>(list: T[]) => [...new Set(list)];

/** Muscles worked by an exercise: detailed data when we have it, otherwise its muscle groups. */
export function musclesFor(ex: { name: string; muscle: string; secondary?: string }): MuscleMap {
  const media = getMedia(ex.name);
  if (media && media.primary.length) {
    const prim = media.primary.filter((m) => DETAILED[m]);
    const sec = media.secondary.filter((m) => DETAILED[m]);
    const primary = unique(prim.map((m) => DETAILED[m].region));
    // A region that is primary stays primary even if a sub-muscle of it is listed as secondary.
    const secondary = unique(sec.map((m) => DETAILED[m].region)).filter((r) => !primary.includes(r));
    const primaryLabels = unique(prim.map((m) => DETAILED[m].label));
    return {
      primary,
      secondary,
      primaryLabels,
      secondaryLabels: unique(sec.map((m) => DETAILED[m].label)).filter((l) => !primaryLabels.includes(l)),
    };
  }
  const extra = (ex.secondary ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g && g !== ex.muscle && GROUPS[g]);
  const primary = GROUPS[ex.muscle] ?? [];
  return {
    primary,
    secondary: unique(extra.flatMap((g) => GROUPS[g])).filter((r) => !primary.includes(r)),
    primaryLabels: GROUPS[ex.muscle] ? [ex.muscle] : [],
    secondaryLabels: extra,
  };
}
