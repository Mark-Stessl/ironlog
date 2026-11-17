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


# Set ticked: a soft, low "pop", like a muted marimba note.
total = 0.35
buf = np.zeros(int(total * RATE))
place(buf, tone(hz(72), 0.3, attack=0.006, decay=22, partials=((1, 1.0), (4, 0.05)), glide=0.06), 0)
save('tick', reverb(lowpass(buf, 2400), length=0.3, mix=0.12), peak=0.35)

# New record: a calm rising arpeggio (C major) landing on a soft chord.
total = 2.2
buf = np.zeros(int(total * RATE))
for i, m in enumerate([72, 76, 79, 84]):  # C5 E5 G5 C6
    place(buf, tone(hz(m), total - i * 0.11, attack=0.02, decay=2.2, partials=((1, 1.0), (2, 0.12))), i * 0.11)
place(buf, tone(hz(91), 1.4, attack=0.05, decay=3.0, partials=((1, 0.25),)), 0.42)  # airy G6 on top
save('record', reverb(lowpass(buf, 4000), length=1.4, mix=0.28), peak=0.6)

# Rest over: two gentle notes, a fourth apart (like a soft doorbell).
total = 1.6
buf = np.zeros(int(total * RATE))
place(buf, tone(hz(76), 1.5, attack=0.015, decay=2.6, partials=((1, 1.0), (2, 0.1))), 0)
place(buf, tone(hz(81), 1.3, attack=0.015, decay=2.4, partials=((1, 1.0), (2, 0.1))), 0.22)
save('rest', reverb(lowpass(buf, 3500), length=1.2, mix=0.25), peak=0.6)

# Workout complete: a warm chord that blooms in, with a soft top note.
total = 2.6
buf = np.zeros(int(total * RATE))
for k, m in enumerate([60, 64, 67, 72]):  # C4 E4 G4 C5
    place(buf, tone(hz(m), total - 0.03 * k, attack=0.06, decay=1.4, partials=((1, 1.0), (2, 0.15))), 0.03 * k)
place(buf, tone(hz(79), 2.0, attack=0.08, decay=1.8, partials=((1, 0.45),)), 0.32)
save('complete', reverb(lowpass(buf, 3200), length=1.6, mix=0.3), peak=0.6)
print('sounds written')
