// Built-in exercise and machine library. [name, muscle, equipment, aliases]
// Aliases include common gym-floor names and German names so search finds them.

export const MUSCLES = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
] as const;

export const EQUIPMENT = [
  'Machine',
  'Cable',
  'Smith Machine',
  'Barbell',
  'Dumbbell',
  'Kettlebell',
  'Bodyweight',
  'Other',
] as const;

export type SeedExercise = readonly [name: string, muscle: string, equipment: string, aliases: string];

export const SEED_EXERCISES: SeedExercise[] = [
  // ── Chest ─────────────────────────────────────────────
  ['Chest Press (Machine)', 'Chest', 'Machine', 'Brustpresse, seated chest press'],
  ['Incline Chest Press (Machine)', 'Chest', 'Machine', 'Schrägbankpresse Maschine, incline press'],
  ['Decline Chest Press (Machine)', 'Chest', 'Machine', 'decline press'],
  ['Pec Deck', 'Chest', 'Machine', 'Butterfly, chest fly machine, Butterfly Maschine'],
  ['Cable Crossover', 'Chest', 'Cable', 'cable fly, Kabelzug Brust'],
  ['Low Cable Fly', 'Chest', 'Cable', 'low to high fly'],
  ['Bench Press (Barbell)', 'Chest', 'Barbell', 'Bankdrücken, flat bench'],
  ['Incline Bench Press (Barbell)', 'Chest', 'Barbell', 'Schrägbankdrücken'],
  ['Decline Bench Press (Barbell)', 'Chest', 'Barbell', 'Negativbankdrücken'],
  ['Bench Press (Dumbbell)', 'Chest', 'Dumbbell', 'Kurzhantel Bankdrücken'],
  ['Incline Bench Press (Dumbbell)', 'Chest', 'Dumbbell', 'Kurzhantel Schrägbank'],
  ['Dumbbell Fly', 'Chest', 'Dumbbell', 'Fliegende, chest fly'],
  ['Bench Press (Smith Machine)', 'Chest', 'Smith Machine', 'Multipresse Bankdrücken'],
  ['Incline Bench Press (Smith Machine)', 'Chest', 'Smith Machine', 'Multipresse Schrägbank'],
  ['Push Up', 'Chest', 'Bodyweight', 'Liegestütz, pushup'],
  ['Chest Dip', 'Chest', 'Bodyweight', 'Dips, Barrenstütz'],
  ['Assisted Dip (Machine)', 'Chest', 'Machine', 'dip machine, Dip Maschine'],

  // ── Back ──────────────────────────────────────────────
  ['Lat Pulldown', 'Back', 'Cable', 'Latzug, Latziehen, pulldown machine'],
  ['Close Grip Lat Pulldown', 'Back', 'Cable', 'Latzug eng, V-bar pulldown'],
  ['Lat Pulldown (Machine)', 'Back', 'Machine', 'Latzug Maschine, plate loaded pulldown'],
  ['Seated Cable Row', 'Back', 'Cable', 'Rudern am Kabel, Ruderzug, low row'],
  ['Seated Row (Machine)', 'Back', 'Machine', 'Rudermaschine, Ruderzug Maschine'],
  ['T-Bar Row', 'Back', 'Machine', 'T-Hantel Rudern'],
  ['Straight Arm Pulldown', 'Back', 'Cable', 'Überzüge am Kabel, lat prayer'],
  ['Assisted Pull Up (Machine)', 'Back', 'Machine', 'Klimmzug Maschine, pull up machine'],
  ['Pull Up', 'Back', 'Bodyweight', 'Klimmzug, pullup'],
  ['Chin Up', 'Back', 'Bodyweight', 'Klimmzug Untergriff, chinup'],
  ['Bent Over Row (Barbell)', 'Back', 'Barbell', 'Langhantelrudern, barbell row'],
  ['Dumbbell Row', 'Back', 'Dumbbell', 'Kurzhantelrudern, one arm row'],
  ['Deadlift (Barbell)', 'Back', 'Barbell', 'Kreuzheben'],
  ['Back Extension', 'Back', 'Machine', 'Hyperextension, Rückenstrecker'],
  ['Shrug (Dumbbell)', 'Back', 'Dumbbell', 'Schulterheben, traps'],
  ['Shrug (Barbell)', 'Back', 'Barbell', 'Schulterheben Langhantel, traps'],
  ['Face Pull', 'Back', 'Cable', 'rear delts cable'],

  // ── Shoulders ─────────────────────────────────────────
  ['Shoulder Press (Machine)', 'Shoulders', 'Machine', 'Schulterpresse, overhead press machine'],
  ['Lateral Raise (Machine)', 'Shoulders', 'Machine', 'Seitheben Maschine'],
  ['Reverse Fly (Machine)', 'Shoulders', 'Machine', 'Reverse Butterfly, rear delt fly, reverse pec deck'],
  ['Lateral Raise (Cable)', 'Shoulders', 'Cable', 'Seitheben Kabel'],
  ['Overhead Press (Barbell)', 'Shoulders', 'Barbell', 'Schulterdrücken, military press, OHP'],
  ['Shoulder Press (Dumbbell)', 'Shoulders', 'Dumbbell', 'Kurzhantel Schulterdrücken'],
  ['Arnold Press', 'Shoulders', 'Dumbbell', ''],
  ['Lateral Raise (Dumbbell)', 'Shoulders', 'Dumbbell', 'Seitheben'],
  ['Front Raise (Dumbbell)', 'Shoulders', 'Dumbbell', 'Frontheben'],
  ['Rear Delt Fly (Dumbbell)', 'Shoulders', 'Dumbbell', 'vorgebeugtes Seitheben'],
  ['Shoulder Press (Smith Machine)', 'Shoulders', 'Smith Machine', 'Multipresse Schulterdrücken'],
  ['Upright Row', 'Shoulders', 'Barbell', 'aufrechtes Rudern'],

  // ── Biceps ────────────────────────────────────────────
  ['Bicep Curl (Machine)', 'Biceps', 'Machine', 'Bizepsmaschine, curl machine'],
  ['Preacher Curl (Machine)', 'Biceps', 'Machine', 'Scottcurl Maschine'],
  ['Bicep Curl (Cable)', 'Biceps', 'Cable', 'Bizeps Kabel'],
  ['Bicep Curl (Barbell)', 'Biceps', 'Barbell', 'Langhantelcurl'],
  ['EZ Bar Curl', 'Biceps', 'Barbell', 'SZ Curl, SZ-Stange'],
  ['Bicep Curl (Dumbbell)', 'Biceps', 'Dumbbell', 'Kurzhantelcurl'],
  ['Hammer Curl', 'Biceps', 'Dumbbell', 'Hammercurl'],
  ['Incline Curl (Dumbbell)', 'Biceps', 'Dumbbell', 'Schrägbank Curl'],
  ['Concentration Curl', 'Biceps', 'Dumbbell', 'Konzentrationscurl'],
  ['Preacher Curl (EZ Bar)', 'Biceps', 'Barbell', 'Scottcurl'],

  // ── Triceps ───────────────────────────────────────────
  ['Tricep Pushdown', 'Triceps', 'Cable', 'Trizepsdrücken, pushdown bar'],
  ['Tricep Rope Pushdown', 'Triceps', 'Cable', 'Trizeps Seil, rope pushdown'],
  ['Overhead Tricep Extension (Cable)', 'Triceps', 'Cable', 'Trizeps über Kopf'],
  ['Tricep Extension (Machine)', 'Triceps', 'Machine', 'Trizepsmaschine'],
  ['Seated Dip (Machine)', 'Triceps', 'Machine', 'Dip Maschine, tricep dip machine'],
  ['Skull Crusher', 'Triceps', 'Barbell', 'Stirndrücken, lying tricep extension'],
  ['Close Grip Bench Press', 'Triceps', 'Barbell', 'enges Bankdrücken'],
  ['Overhead Tricep Extension (Dumbbell)', 'Triceps', 'Dumbbell', 'Trizepsdrücken Kurzhantel'],
  ['Tricep Kickback', 'Triceps', 'Dumbbell', 'Kickbacks'],
  ['Bench Dip', 'Triceps', 'Bodyweight', 'Bankdips'],

  // ── Forearms ──────────────────────────────────────────
  ['Wrist Curl', 'Forearms', 'Dumbbell', 'Handgelenkcurl'],
  ['Reverse Curl', 'Forearms', 'Barbell', 'Reverse Curl Obergriff'],
  ["Farmer's Walk", 'Forearms', 'Dumbbell', 'farmers carry'],

  // ── Quads ─────────────────────────────────────────────
  ['Leg Press', 'Quads', 'Machine', 'Beinpresse, 45 degree leg press'],
  ['Leg Extension', 'Quads', 'Machine', 'Beinstrecker'],
  ['Hack Squat', 'Quads', 'Machine', 'Hackenschmidt'],
  ['Pendulum Squat', 'Quads', 'Machine', ''],
  ['Squat (Smith Machine)', 'Quads', 'Smith Machine', 'Multipresse Kniebeuge'],
  ['Squat (Barbell)', 'Quads', 'Barbell', 'Kniebeuge'],
  ['Front Squat', 'Quads', 'Barbell', 'Frontkniebeuge'],
  ['Goblet Squat', 'Quads', 'Dumbbell', ''],
  ['Bulgarian Split Squat', 'Quads', 'Dumbbell', 'Bulgarische Kniebeuge'],
  ['Lunge (Dumbbell)', 'Quads', 'Dumbbell', 'Ausfallschritt'],
  ['Walking Lunge', 'Quads', 'Dumbbell', 'Ausfallschritte gehend'],

  // ── Hamstrings ────────────────────────────────────────
  ['Seated Leg Curl', 'Hamstrings', 'Machine', 'Beinbeuger sitzend'],
  ['Lying Leg Curl', 'Hamstrings', 'Machine', 'Beinbeuger liegend'],
  ['Romanian Deadlift (Barbell)', 'Hamstrings', 'Barbell', 'RDL, rumänisches Kreuzheben'],
  ['Romanian Deadlift (Dumbbell)', 'Hamstrings', 'Dumbbell', 'RDL Kurzhantel'],
  ['Good Morning', 'Hamstrings', 'Barbell', ''],

  // ── Glutes ────────────────────────────────────────────
  ['Hip Thrust (Machine)', 'Glutes', 'Machine', 'Hip Thrust Maschine'],
  ['Hip Thrust (Barbell)', 'Glutes', 'Barbell', 'Beckenheben'],
  ['Hip Abduction (Machine)', 'Glutes', 'Machine', 'Abduktoren, outer thigh'],
  ['Hip Adduction (Machine)', 'Glutes', 'Machine', 'Adduktoren, inner thigh'],
  ['Glute Kickback (Machine)', 'Glutes', 'Machine', 'Kickback Maschine'],
  ['Cable Kickback', 'Glutes', 'Cable', 'Kickback Kabel'],
  ['Kettlebell Swing', 'Glutes', 'Kettlebell', ''],

  // ── Calves ────────────────────────────────────────────
  ['Standing Calf Raise (Machine)', 'Calves', 'Machine', 'Wadenheben stehend, Wadenmaschine'],
  ['Seated Calf Raise', 'Calves', 'Machine', 'Wadenheben sitzend'],
  ['Calf Press (Leg Press)', 'Calves', 'Machine', 'Wadenheben Beinpresse'],
  ['Calf Raise (Smith Machine)', 'Calves', 'Smith Machine', 'Wadenheben Multipresse'],

  // ── Core ──────────────────────────────────────────────
  ['Ab Crunch (Machine)', 'Core', 'Machine', 'Bauchmaschine, crunch machine'],
  ['Torso Rotation (Machine)', 'Core', 'Machine', 'Rumpfrotation, obliques'],
  ['Cable Crunch', 'Core', 'Cable', 'Kabelcrunch'],
  ['Hanging Leg Raise', 'Core', 'Bodyweight', 'Beinheben hängend'],
  ["Captain's Chair Leg Raise", 'Core', 'Bodyweight', 'Beinheben, knee raise'],
  ['Crunch', 'Core', 'Bodyweight', 'Bauchpressen'],
  ['Plank', 'Core', 'Bodyweight', 'Unterarmstütz'],
  ['Russian Twist', 'Core', 'Bodyweight', ''],
  ['Ab Wheel', 'Core', 'Other', 'Bauchroller, ab rollout'],
];
