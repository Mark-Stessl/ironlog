// Shapes for the body map (original drawing). Each figure is 120 × 270 units.
// `half` shapes are drawn on the left side and mirrored to the right;
// `center` shapes sit on the middle line and are drawn once.
import type { Region } from './muscles';

export type Figure = {
  outline: string[]; // body silhouette (left half, mirrored)
  head: { cx: number; cy: number; rx: number; ry: number };
  half: Partial<Record<Region, string[]>>;
  center: Partial<Record<Region, string[]>>;
};

const HALF_OUTLINE = [
  // neck, shoulder, outer arm down to the hand, inner arm back up, torso, outer leg, foot, inner leg
  'M60,36 L54,37 Q53,42 50,44 Q40,45 34,49 Q28,54 28,64 L26,96 Q24,104 23,118 L21,140 Q19,148 21,156 Q24,160 27,154 L28,142 Q30,128 32,118 L35,100 Q37,90 38,80 L40,96 Q40,108 41,118 Q39,128 40,140 L42,170 Q44,190 44,200 Q42,215 44,232 L46,250 Q42,256 44,262 L55,262 Q56,256 55,250 L56,232 Q57,214 56,200 L57,182 Q58,160 59,142 L60,140 Z',
];

const HEAD = { cx: 60, cy: 22, rx: 11, ry: 13.5 };

const DELT_FRONT = 'M42,47 Q33,48 31,57 Q31,66 34,70 Q38,64 42,58 Q45,52 44,48 Z';
const DELT_SIDE = 'M31,52 Q27,58 28,68 L30.5,70 Q29.5,60 32.5,52 Z';
const UPPER_ARM = 'M35,72 Q30,76 29,88 Q30,96 34,98 Q38,92 38,84 Q38,76 35,72 Z';
const FOREARM = 'M28,102 Q24,112 24,124 Q25,134 26,138 L29,138 Q32,124 34,112 Q35,104 33,100 Z';

export const FRONT: Figure = {
  outline: HALF_OUTLINE,
  head: HEAD,
  half: {
    traps: ['M54,38 Q49,43 43,45.5 L51,46 Q55,43 56,40 Z'],
    frontDelts: [DELT_FRONT],
    sideDelts: [DELT_SIDE],
    chest: ['M58,48 Q48,46 44.5,50 Q41.5,58 42.5,66 Q46,74 54,74 Q58,73 58,70 Z'],
    serratus: ['M42,71 L45,73.5 L42,77 L45,79.5 L42,83.5 Q40.5,78 40.5,74 Z'],
    biceps: [UPPER_ARM],
    forearms: [FOREARM],
    abs: [
      'M52.5,78 h5.5 v9.5 h-5.5 Z',
      'M52.5,89.5 h5.5 v9.5 h-5.5 Z',
      'M52.5,101 h5.5 v10.5 h-5.5 Z',
      'M53,113.5 h5 v12 h-5 Z',
    ],
    obliques: ['M47,80 Q43.5,94 44,108 Q45.5,116 50.5,120 L51,82 Z'],
    hipFlexors: ['M50,123 Q45.5,127 44.5,134 L52,139.5 L55,128 Z'],
    quads: ['M43.5,141 Q40.5,160 42.5,182 Q46,194 52,194 Q56,186 56,166 Q55,150 52.5,141 Z'],
    adductors: ['M56.5,143 Q59,153 58.5,168 L55.8,168 Q55,154 54.6,145 Z'],
    calves: ['M45,204 Q42,216 45,232 L47.2,232 Q46.2,216 48.2,204 Z'],
    shins: ['M50,204 Q49,220 50.3,240 L53,240 Q53.5,220 53.2,204 Z'],
  },
  center: {},
};

export const BACK: Figure = {
  outline: HALF_OUTLINE,
  head: HEAD,
  half: {
    rearDelts: [DELT_FRONT],
    sideDelts: [DELT_SIDE],
    rotatorCuff: ['M44.5,54 Q40.5,60 43.5,67.5 Q48,70 51,64 Q50,56 44.5,54 Z'],
    upperBack: ['M52.5,55 L57.2,58.5 L57.2,74 L52.5,70.5 Z'],
    lats: ['M43,71 Q40,84 45,100 Q50,108 56.5,110 L57,80 Q52,74 43,71 Z'],
    lowerBack: ['M53.5,100 Q52.5,112 54.5,124 L58.4,126 L58.4,100 Z'],
    triceps: [UPPER_ARM],
    forearms: [FOREARM],
    sideGlutes: ['M42,119.5 Q39,128 42,136 L46,128 Q46.5,122 42,119.5 Z'],
    glutes: ['M46.5,122 Q42.5,132 45,144 Q51,150 58.5,146 L59,126 Q52,120 46.5,122 Z'],
    hamstrings: ['M43.5,150 Q41,168 44,188 L52.5,192 Q57,174 56.5,152 Q50,148 43.5,150 Z'],
    calves: ['M45,200 Q41,214 45.5,230 L54,230 Q57,214 54.5,200 Q50,196 45,200 Z'],
  },
  center: {
    traps: ['M60,36.5 L50.5,44 L42.5,47 L52,50 L60,72 L68,50 L77.5,47 L69.5,44 Z'],
  },
};
