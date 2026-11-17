"""Synthesizes Ironlog's sound effects (original, no samples).

Usage: python3 scripts/make-sounds.py   (writes assets/sounds/*.wav)
"""
import wave

import numpy as np

RATE = 44100


def note(freq, start, dur, total, amp=1.0, decay=4.0, partials=((1, 1.0), (2.0, 0.35), (3.01, 0.12))):
    """A soft bell-like tone placed at `start` seconds inside a buffer of `total` seconds."""
    out = np.zeros(int(total * RATE))
    t = np.arange(int(dur * RATE)) / RATE
    env = np.exp(-decay * t) * np.minimum(1, t / 0.004)  # 4 ms attack, no click
    tone = sum(a * np.sin(2 * np.pi * freq * m * t) for m, a in partials)
    i = int(start * RATE)
    seg = (amp * env * tone)[: len(out) - i]
    out[i : i + len(seg)] += seg
    return out


def save(name, sig, peak=0.7):
    sig = sig / np.max(np.abs(sig)) * peak
    fade = int(0.02 * RATE)
    sig[-fade:] *= np.linspace(1, 0, fade)
    data = (sig * 32767).astype('<i2')
    with wave.open(f'assets/sounds/{name}.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


hz = lambda midi: 440 * 2 ** ((midi - 69) / 12)

# Set ticked: a short, soft wooden "tok".
total = 0.09
save('tick', note(1320, 0, total, total, decay=55, partials=((1, 1.0), (2.76, 0.3))) + note(660, 0, total, total, amp=0.5, decay=40), peak=0.45)

# New record: quick rising major arpeggio that lands on a shimmering chord.
total = 1.4
sig = np.zeros(int(total * RATE))
for i, m in enumerate([76, 80, 83, 88]):  # E5 G#5 B5 E6
    sig += note(hz(m), i * 0.075, total - i * 0.075, total, amp=0.9 if i < 3 else 1.1, decay=3.2)
sig += note(hz(95), 0.3, 1.0, total, amp=0.25, decay=5)  # sparkle B6
save('record', sig, peak=0.75)

# Rest over: two-note chime (A5 -> E6).
total = 1.0
save('rest', note(hz(81), 0, total, total, decay=4) + note(hz(88), 0.16, total - 0.16, total, decay=3.5), peak=0.7)

# Workout complete: warm C major chord, then a bright top note.
total = 1.8
sig = sum(note(hz(m), 0.02 * k, total, total, amp=0.8, decay=2.2) for k, m in enumerate([60, 64, 67, 72]))
sig += note(hz(84), 0.35, total - 0.35, total, amp=0.6, decay=2.6) + note(hz(88), 0.45, total - 0.45, total, amp=0.35, decay=3)
save('complete', sig, peak=0.75)
print('sounds written')
