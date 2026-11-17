"""Synthesizes Ironlog's sound effects (original, no samples).

Soft attacks, warm tones (few bright overtones), a gentle low-pass and a short
room reverb so nothing sounds clicky or harsh.

Usage: python3 scripts/make-sounds.py   (writes assets/sounds/*.wav)
"""
import wave

import numpy as np

RATE = 44100
rng = np.random.default_rng(7)  # fixed seed: same files every run


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def tone(freq, dur, attack=0.012, decay=3.0, partials=((1, 1.0), (2, 0.18), (3, 0.04)), glide=0.0):
    """Sine-based tone with a smooth (raised-cosine) attack and exponential decay.
    `glide` bends the pitch down slightly at the start, which sounds rounder."""
    t = np.arange(int(dur * RATE)) / RATE
    a = np.clip(t / attack, 0, 1)
    env = (0.5 - 0.5 * np.cos(np.pi * a)) * np.exp(-decay * t)
    f = freq * (1 + glide * np.exp(-t * 40))
    phase = 2 * np.pi * np.cumsum(f) / RATE
    return env * sum(amp * np.sin(m * phase) for m, amp in partials)


def place(buf, sig, at):
    i = int(at * RATE)
    n = min(len(sig), len(buf) - i)
    buf[i : i + n] += sig[:n]


def lowpass(sig, cutoff):
    """Gentle one-pole low-pass, run twice (12 dB/oct)."""
    a = np.exp(-2 * np.pi * cutoff / RATE)
    for _ in range(2):
        out = np.empty_like(sig)
        y = 0.0
        for i, x in enumerate(sig):
            y = (1 - a) * x + a * y
            out[i] = y
        sig = out
    return sig


def reverb(sig, length=0.9, mix=0.22, tone_hz=3500):
    """Small, dark room: convolve with decaying, low-passed noise."""
    n = int(length * RATE)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / RATE * 6.0)
    ir = lowpass(ir, tone_hz)
    ir /= np.sqrt(np.sum(ir**2))
    wet = np.convolve(sig, ir)[: len(sig)]
    return (1 - mix) * sig + mix * wet


def save(name, sig, peak):
    sig = sig / np.max(np.abs(sig)) * peak
    fade = int(0.08 * RATE)
    sig[-fade:] *= np.linspace(1, 0, fade) ** 2
    data = (sig * 32767).astype('<i2')
    with wave.open(f'assets/sounds/{name}.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


# All sounds: low-ish pitches, almost pure sine tones, slow-ish fade-in, dark low-pass
# and a soft room, so they feel round and calm rather than "beepy".
SOFT = ((1, 1.0), (2, 0.06))

# New record: a calm rising G major arpeggio that settles into a warm chord.
total = 2.6
buf = np.zeros(int(total * RATE))
for i, m in enumerate([67, 71, 74, 79]):  # G4 B4 D5 G5
    place(buf, tone(hz(m), total - i * 0.13, attack=0.035, decay=1.7, partials=SOFT), i * 0.13)
place(buf, tone(hz(86), 1.6, attack=0.12, decay=2.2, partials=((1, 0.18),)), 0.5)  # faint D6 shimmer
save('record', reverb(lowpass(buf, 2600), length=1.8, mix=0.34, tone_hz=2200), peak=0.55)

# Rest over: two soft notes going up a fourth.
total = 1.9
buf = np.zeros(int(total * RATE))
place(buf, tone(hz(72), 1.8, attack=0.03, decay=2.1, partials=SOFT), 0)
place(buf, tone(hz(77), 1.6, attack=0.03, decay=2.0, partials=SOFT), 0.26)
save('rest', reverb(lowpass(buf, 2400), length=1.5, mix=0.32, tone_hz=2200), peak=0.55)

# Workout complete: a warm chord that blooms in slowly, with a soft top note.
total = 3.0
buf = np.zeros(int(total * RATE))
for k, m in enumerate([55, 60, 64, 67]):  # G3 C4 E4 G4
    place(buf, tone(hz(m), total - 0.05 * k, attack=0.14, decay=1.1, partials=SOFT), 0.05 * k)
place(buf, tone(hz(72), 2.4, attack=0.16, decay=1.4, partials=((1, 0.4),)), 0.38)
save('complete', reverb(lowpass(buf, 2200), length=2.0, mix=0.36, tone_hz=2000), peak=0.55)
print('sounds written')
