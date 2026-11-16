"""Builds src/lib/exercise-media.json from the RepDB free-tier exercises.json.

Usage: python3 scripts/build-exercise-media.py path/to/exercises.json

Only the exercises in Ironlog's built-in list are kept (names, instructions,
tips and image paths). The images themselves are not copied into this repo;
the app loads them from RepDB's own site at runtime.
Exercise data by RepDB (repdb.co), see https://repdb.co
"""
import json
import sys

# Ironlog exercise name -> RepDB id. Missing names keep the plain icon.
MAP = {
    'Chest Press (Machine)': 'chest-press-machine',
    'Pec Deck': 'pec-deck',
    'Cable Crossover': 'cable-fly',
    'Low Cable Fly': 'cable-fly',
    'Bench Press (Barbell)': 'bench-press',
    'Incline Bench Press (Barbell)': 'incline-bench-press',
    'Decline Bench Press (Barbell)': 'decline-bench-press-barbell',
    'Bench Press (Dumbbell)': 'db-bench-press',
    'Incline Bench Press (Dumbbell)': 'incline-db-press',
    'Dumbbell Fly': 'db-fly',
    'Bench Press (Smith Machine)': 'smith-machine-bench-press',
    'Incline Bench Press (Smith Machine)': 'smith-machine-incline-bench-press',
    'Push Up': 'push-up',
    'Chest Dip': 'dips',
    'Assisted Dip (Machine)': 'assisted-dips',
    'Lat Pulldown': 'lat-pulldown',
    'Close Grip Lat Pulldown': 'close-grip-lat-pulldown',
    'Lat Pulldown (Machine)': 'lat-pulldown',
    'Seated Cable Row': 'seated-cable-row',
    'Seated Row (Machine)': 'chest-supported-machine-row',
    'T-Bar Row': 't-bar-row',
    'Straight Arm Pulldown': 'straight-arm-pulldown',
    'Assisted Pull Up (Machine)': 'assisted-pull-ups',
    'Pull Up': 'pull-up',
    'Chin Up': 'chin-ups',
    'Bent Over Row (Barbell)': 'barbell-row',
    'Dumbbell Row': 'single-arm-db-row',
    'Deadlift (Barbell)': 'deadlift',
    'Back Extension': 'back-extension',
    'Shrug (Dumbbell)': 'db-shrug',
    'Shrug (Barbell)': 'shrug',
    'Face Pull': 'face-pull',
    'Shoulder Press (Machine)': 'machine-shoulder-press',
    'Lateral Raise (Machine)': 'plate-loaded-lateral-raise',
    'Reverse Fly (Machine)': 'machine-reverse-fly',
    'Lateral Raise (Cable)': 'cable-lateral-raise',
    'Overhead Press (Barbell)': 'ohp',
    'Shoulder Press (Dumbbell)': 'dumbbell-shoulder-press',
    'Arnold Press': 'arnold-press',
    'Lateral Raise (Dumbbell)': 'lateral-raise',
    'Front Raise (Dumbbell)': 'dumbbell-front-raise',
    'Rear Delt Fly (Dumbbell)': 'rear-delt-fly',
    'Shoulder Press (Smith Machine)': 'smith-machine-shoulder-press',
    'Upright Row': 'upright-row',
    'Bicep Curl (Machine)': 'machine-bicep-curl',
    'Preacher Curl (Machine)': 'machine-preacher-curl',
    'Bicep Curl (Cable)': 'cable-curl',
    'Bicep Curl (Barbell)': 'barbell-curl',
    'EZ Bar Curl': 'ez-bar-curl',
    'Bicep Curl (Dumbbell)': 'bicep-curl',
    'Hammer Curl': 'hammer-curl',
    'Incline Curl (Dumbbell)': 'incline-db-curl',
    'Concentration Curl': 'concentration-curl',
    'Preacher Curl (EZ Bar)': 'preacher-curl',
    'Tricep Pushdown': 'tricep-pushdown',
    'Tricep Rope Pushdown': 'tricep-pushdown',
    'Overhead Tricep Extension (Cable)': 'cable-overhead-tricep-extension',
    'Tricep Extension (Machine)': 'machine-triceps-extension',
    'Seated Dip (Machine)': 'seated-dip-machine',
    'Skull Crusher': 'skull-crusher',
    'Close Grip Bench Press': 'close-grip-bench-press',
    'Overhead Tricep Extension (Dumbbell)': 'dumbbell-tricep-extension',
    'Tricep Kickback': 'tricep-kickback',
    'Bench Dip': 'bench-dips',
    'Wrist Curl': 'dumbbell-wrist-curl',
    'Reverse Curl': 'reverse-curl',
    "Farmer's Walk": 'dumbbell-farmers-walk',
    'Leg Press': 'leg-press',
    'Leg Extension': 'leg-extension',
    'Hack Squat': 'hack-squat',
    'Squat (Smith Machine)': 'smith-machine-squat',
    'Squat (Barbell)': 'squat',
    'Front Squat': 'front-squat',
    'Goblet Squat': 'goblet-squat',
    'Bulgarian Split Squat': 'bulgarian-split-squat',
    'Lunge (Dumbbell)': 'db-lunge',
    'Walking Lunge': 'walking-lunge',
    'Seated Leg Curl': 'seated-leg-curl',
    'Lying Leg Curl': 'leg-curl',
    'Romanian Deadlift (Barbell)': 'romanian-deadlift',
    'Romanian Deadlift (Dumbbell)': 'dumbbell-romanian-deadlift',
    'Good Morning': 'good-morning',
    'Hip Thrust (Machine)': 'plate-loaded-glute-drive',
    'Hip Thrust (Barbell)': 'hip-thrust',
    'Hip Abduction (Machine)': 'hip-abduction',
    'Hip Adduction (Machine)': 'hip-adduction',
    'Cable Kickback': 'cable-kickback',
    'Kettlebell Swing': 'kettlebell-swing',
    'Standing Calf Raise (Machine)': 'machine-calf-raise',
    'Seated Calf Raise': 'seated-calf-raise',
    'Calf Raise (Smith Machine)': 'smith-machine-calf-raise',
    'Ab Crunch (Machine)': 'machine-seated-crunch',
    'Cable Crunch': 'cable-crunch',
    'Hanging Leg Raise': 'hanging-leg-raise',
    "Captain's Chair Leg Raise": 'captains-chair-leg-raise',
    'Crunch': 'crunches',
    'Plank': 'plank',
    'Russian Twist': 'russian-twist',
    'Ab Wheel': 'ab-wheel-rollout',
}


def main(path: str) -> None:
    data = {e['id']: e for e in json.load(open(path))['exercises']}
    out = {}
    for name, rid in MAP.items():
        e = data[rid]  # KeyError here means the mapping points at a missing id
        imgs = e['images']['flat']
        frames = [imgs[k] for k in ('start', 'peak', 'main') if k in imgs]
        out[name] = {
            'id': rid,
            'frames': [f.removeprefix('images/flat/') for f in frames],
            'description': e['description_en'],
            'steps': e['instructions_en'],
            'tips': e['tips_en'],
        }
    with open('src/lib/exercise-media.json', 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'{len(out)} exercises written')


if __name__ == '__main__':
    main(sys.argv[1])
