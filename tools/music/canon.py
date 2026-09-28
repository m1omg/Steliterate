"""Pachelbel's Canon in D (public domain), arranged for Steliterate's Degenerate Age.

A dark, slow, tracker-flavoured arrangement: ground bass, three voices in canon two bars
apart, sampled-sounding string and choir pads with glides and fading notes, glassy plucks
for the running figures, an 8-bit sample-and-hold crunch, sub drone, dark reverb, tape wow.
"""
import numpy as np
from scipy import signal
import sys, wave

SR = 48000
Q = 1.3                      # seconds per quarter note (about 46 BPM)
CYCLE = 8 * Q                # one pass of the ground bass
rng = np.random.default_rng(1680)

NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def midi(n):
    name, octv = n[:-1], int(n[-1])
    return 12 * (octv + 1) + NOTE[name]
def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def seq(spec, beats):
    """'F#5 E5 ...' with every note lasting `beats` quarters -> [(midi, beats)]."""
    return [(midi(x), beats) for x in spec.split()]

def figure(spec):
    """Beats written as groups: '16:A5 32:F#5 32:G5 ...' -> [(midi, beats)]."""
    out = []
    for tok in spec.split():
        d, n = tok.split(':')
        out.append((midi(n), {'8': 0.5, '16': 0.25, '32': 0.125}[d]))
    return out

GROUND = seq('D3 A2 B2 F#2 G2 D2 G2 A2', 1)

VAR = {
    'A': seq('F#5 E5 D5 C#5 B4 A4 B4 C#5', 1),
    'B': seq('D5 C#5 B4 A4 G4 F#4 G4 E4', 1),
    'C': seq('D4 F#4 A4 G4 F#4 D4 F#4 E4 D4 B3 D4 A4 G4 B4 A4 G4', 0.5),
    'D': seq('F#4 D4 E4 C#5 D5 F#5 A5 A4 B4 G4 A4 F#4 D4 D5 D5 C#5', 0.5),
    'E': seq('D5 C#5 D5 D4 C#4 A4 E4 F#4 D4 D5 C#5 B4 C#5 F#5 A5 B5 '
             'G5 F#5 E5 G5 F#5 E5 D5 C#5 B4 A4 G4 F#4 E4 G4 F#4 E4', 0.25),
    'F': seq('D5 E5 F#5 G5 A5 E5 A5 G5 F#5 B5 A5 G5 A5 G5 F#5 E5 '
             'D5 B4 B4 C#5 D5 C#5 B4 A4 G4 F#4 E4 G4 F#4 E4 D4 E4', 0.25),
    'G': figure('16:A5 32:F#5 32:G5 16:A5 32:F#5 32:G5 '
                '32:A5 32:A4 32:B4 32:C#5 32:D5 32:E5 32:F#5 32:G5 '
                '16:F#5 32:D5 32:E5 16:F#5 32:F#4 32:G4 '
                '32:A4 32:B4 32:A4 32:G4 32:A4 32:F#4 32:G4 32:A4 '
                '16:G4 32:B4 32:A4 16:G4 32:F#4 32:E4 '
                '32:F#4 32:E4 32:D4 32:E4 32:F#4 32:G4 32:A4 32:B4 '
                '16:G4 32:B4 32:A4 16:B4 32:C#5 32:D5 '
                '32:A4 32:B4 32:C#5 32:D5 32:E5 32:F#5 32:G5 32:A5'),
    'H': figure('16:F#5 32:D5 32:E5 16:F#5 32:E5 32:D5 '
                '32:E5 32:A4 32:B4 32:C#5 32:D5 32:E5 32:D5 32:C#5 '
                '16:D5 32:B4 32:C#5 16:D5 32:D4 32:E4 '
                '32:F#4 32:G4 32:F#4 32:E4 32:F#4 32:D5 32:C#5 32:D5 '
                '16:B4 32:D5 32:C#5 16:B4 32:A4 32:G4 '
                '32:A4 32:G4 32:F#4 32:G4 32:A4 32:B4 32:C#5 32:D5 '
                '16:B4 32:D5 32:C#5 16:D5 32:C#5 32:D5 '
                '32:C#5 32:D5 32:E5 32:D5 32:E5 32:F#5 32:G5 32:A5'),
    'Z': seq('F#4 E4 D4 C#4 B3 A3 B3 C#4', 1),   # the opening line again, low, to close
}
# instrument and transposition for each variation: slow lines low and dark, runs bright
VOICING = {'A': ('pad', -12), 'B': ('pad', -12), 'C': ('choir', 0), 'D': ('choir', -12),
           'E': ('glass', 0), 'F': ('glass', 0), 'G': ('glass', 0), 'H': ('glass', 0), 'Z': ('pad', 0)}
ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Z']
CYCLES = 13
TAIL = 14.0
N = int((CYCLES * CYCLE + TAIL) * SR)

def env_adsr(n, a, r, sus_end=1.0):
    """Swell in over `a` s, fade linearly to `sus_end` (the tracker's slow volume slide), release `r` s."""
    t = np.arange(n) / SR
    total = n / SR
    body = total - r
    e = np.minimum(1.0, t / max(a, 1e-3)) ** 1.5
    fade = np.interp(t, [0, max(body, 1e-3)], [1.0, sus_end])
    rel = np.clip((total - t) / max(r, 1e-3), 0, 1) ** 2
    return e * fade * rel

TABLE = 2048
def table(amps, phases):
    k = np.arange(1, len(amps) + 1)[:, None]
    x = np.arange(TABLE)[None, :] / TABLE
    w = (amps[:, None] * np.sin(2 * np.pi * k * x + phases[:, None])).sum(0)
    return w / (np.abs(w).max() + 1e-9)

def read(tab, phase):
    # nearest-sample read, no interpolation: the Amiga way (a little grit on top)
    idx = (phase * TABLE).astype(np.int64) % TABLE
    return tab[idx]

def pitch_curve(n, f0, f_from, glide):
    t = np.arange(n) / SR
    if f_from is None or glide <= 0:
        return np.full(n, f0)
    k = np.clip(t / glide, 0, 1)
    k = 1 - (1 - k) ** 3
    return f_from * (f0 / f_from) ** k

def pad_note(f0, dur, f_from, kind):
    rel = 0.9 if kind == 'pad' else 0.5
    n = int((dur + rel) * SR)
    f = pitch_curve(n, f0, f_from, 0.14 if kind == 'pad' else 0.05)
    t = np.arange(n) / SR
    vib = 1 + 0.0045 * np.sin(2 * np.pi * 5.2 * t + rng.uniform(0, 6)) * np.clip((t - 0.35) / 0.5, 0, 1)
    nh = int(min(48, 15000 / f0))
    k = np.arange(1, nh + 1)
    if kind == 'pad':
        amps = (1 / k) * np.exp(-(k * f0) / 2600.0)
        dets = [-13, -6, 0, 5, 12]
        a = 0.32
    else:  # choir: an "aah" through three formants
        fk = k * f0
        form = (np.exp(-((fk - 750) / 160) ** 2) + 0.7 * np.exp(-((fk - 1150) / 190) ** 2)
                + 0.35 * np.exp(-((fk - 2650) / 300) ** 2) + 0.04)
        amps = form / k ** 0.35
        dets = [-8, 0, 7]
        a = 0.09
    out = np.zeros(n)
    for c in dets:
        tab = table(amps, rng.uniform(0, 2 * np.pi, nh))
        ph = np.cumsum(f * vib * 2 ** (c / 1200) / SR) + rng.uniform()
        out += read(tab, ph)
    out /= len(dets) ** 0.5
    return out * env_adsr(n, a, rel, 0.62)

def glass_note(f0, dur):
    ring = 0.38 if dur <= 0.125 * Q + 1e-6 else 0.6
    n = int((dur + ring * 2.2) * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f0 * t
    idx = 2.0 * np.exp(-t / 0.09) + 0.35
    y = np.sin(ph + idx * np.sin(2 * ph)) + 0.18 * np.sin(7 * ph) * np.exp(-t / 0.05)
    e = np.minimum(1, t / 0.004) * np.exp(-t / ring)
    return y * e

def bass_note(f0, dur, f_from):
    n = int((dur + 0.5) * SR)
    f = pitch_curve(n, f0, f_from, 0.09)
    nh = int(min(24, 9000 / f0))
    k = np.arange(1, nh + 1)
    amps = (1 / k) * np.exp(-k / 5.0)
    tab = table(amps, np.zeros(nh))
    ph = np.cumsum(f / SR)
    y = 0.8 * read(tab, ph) + 0.55 * np.sin(2 * np.pi * ph / 2)
    return y * env_adsr(n, 0.06, 0.5, 0.7)

def place(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if j > i:
        buf[i:j] += x[: j - i]

def crush(x, rate=16574, bits=8, mix=0.5):
    """Sample-and-hold at an Amiga playback rate and 8-bit steps, blended with the clean signal."""
    step = SR / rate
    idx = (np.floor(np.arange(len(x)) / step) * step).astype(np.int64)
    held = x[np.minimum(idx, len(x) - 1)]
    peak = np.abs(x).max() + 1e-9
    q = 2 ** (bits - 1)
    held = np.round(held / peak * q) / q * peak
    return (1 - mix) * x + mix * held

# ------------------------------------------------------------------ the score
bass = np.zeros(N)
voices = [np.zeros(N) for _ in range(3)]
glass = [np.zeros(N) for _ in range(3)]

prev = None
for c in range(CYCLES):
    t0 = c * CYCLE
    notes = GROUND if c < CYCLES - 1 else [(midi('D2'), 8)]
    at = t0
    for m, b in notes:
        f = hz(m)
        x = bass_note(f, b * Q * 1.02, prev)
        if c == CYCLES - 1:  # the last low D dies away with the chord
            x *= np.interp(np.arange(len(x)) / SR, [0, 3.0, len(x) / SR], [1.0, 1.0, 0.0]) ** 1.6
        place(bass, x, at)
        prev = f
        at += b * Q

for v in range(3):
    fprev = None
    for i, name in enumerate(ORDER):
        c = 1 + v + i
        if c >= CYCLES - 1:
            break
        kind, tr = VOICING[name]
        at = c * CYCLE
        for m, b in VAR[name]:
            f = hz(m + tr)
            d = b * Q
            if kind == 'glass':
                place(glass[v], glass_note(f, d), at)
                fprev = None
            else:
                place(voices[v], pad_note(f, d * 1.03, fprev if kind == 'pad' else None, kind), at)
                fprev = f
            at += d

# the last chord: D major, swelling, then dying away slowly into the tail
fin = CYCLE * (CYCLES - 1)
for i, n in enumerate(['A3', 'D4', 'F#4', 'A4', 'D5']):
    x = pad_note(hz(midi(n)), CYCLE * 0.95, None, 'pad' if i % 2 == 0 else 'choir')
    tt = np.arange(len(x)) / SR
    x *= np.interp(tt, [0, 3.0, len(x) / SR], [1.0, 1.0, 0.0]) ** 1.6
    place(voices[i % 3], 0.8 * x, fin + 0.15 * i)

# sub drone: D and A far down, breathing slowly, in from the dark and back out
t = np.arange(N) / SR
drone = (np.sin(2 * np.pi * hz(midi('D1')) * t) + 0.5 * np.sin(2 * np.pi * hz(midi('A1')) * t + 1.0)
         + 0.25 * np.sin(2 * np.pi * hz(midi('D2')) * t + 2.0) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.031 * t)))
drone *= (0.65 + 0.35 * np.sin(2 * np.pi * 0.047 * t)) * np.clip(t / 9, 0, 1) * np.clip((N / SR - t) / 10, 0, 1)

# glass echoes: a dark dotted-eighth delay
def echo(x, delay=0.75 * Q, fb=0.33, wet=0.32, taps=5):
    b, a = signal.butter(1, 2400 / (SR / 2))
    out = x.copy()
    y = x
    for k in range(1, taps + 1):
        y = signal.lfilter(b, a, y)  # every repeat a little darker
        d = int(delay * SR * k)
        out[d:] += wet * (fb ** (k - 1)) * y[: len(y) - d]
    return out

pan = [-0.38, 0.38, 0.0]
L = np.zeros(N)
R = np.zeros(N)
def add(x, p, g):
    global L, R
    L += x * g * np.cos((p + 1) * np.pi / 4)
    R += x * g * np.sin((p + 1) * np.pi / 4)

# a slow build like the old module's: the ground alone, voice by voice to the runs, then thinning
shape = np.array([0.42, 0.52, 0.62, 0.72, 0.8, 0.86, 0.92, 0.98, 1.0, 0.94, 0.84, 0.74, 0.66, 0.6])
gain = np.interp(np.arange(N) / SR, (np.arange(len(shape)) + 0.5) * CYCLE, shape)
bass *= np.interp(np.arange(N) / SR, (np.arange(len(shape)) + 0.5) * CYCLE, np.clip(shape * 1.15, 0, 1))
for v in range(3):
    voices[v] *= gain
    glass[v] *= gain
add(crush(bass, mix=0.3), 0.0, 0.22)
for v in range(3):
    add(crush(voices[v], mix=0.45), pan[v], 0.2)
    add(crush(echo(glass[v]), rate=16574, bits=8, mix=0.65), pan[v] * 1.4, 0.10)
add(drone, 0.0, 0.10)

# darken: gentle low-pass, then a long dark hall
b, a = signal.butter(2, 6200 / (SR / 2))
L = signal.filtfilt(b, a, L)
R = signal.filtfilt(b, a, R)

def ir(seconds=5.2, seed=0):
    g = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    bright = g.standard_normal(n) * np.exp(-tt * 6.9 / 1.6)
    darkn = signal.lfilter(*signal.butter(2, 1400 / (SR / 2)), g.standard_normal(n)) * np.exp(-tt * 6.9 / seconds) * 2.2
    h = 0.25 * bright + darkn
    h[: int(0.035 * SR)] = 0
    return h / np.sqrt((h ** 2).sum())

wetL = signal.fftconvolve(L, ir(seed=1))[:N]
wetR = signal.fftconvolve(R, ir(seed=2))[:N]
L = 0.72 * L + 0.55 * wetL
R = 0.72 * R + 0.55 * wetR

# tape: slow wow, a little flutter, faint hiss
tt = np.arange(N) / SR
drift = 0.0016 * np.sin(2 * np.pi * 0.33 * tt) + 0.0003 * np.sin(2 * np.pi * 6.1 * tt)
pos = np.cumsum(1 + drift) - 1
pos = np.clip(pos, 0, N - 1)
L = np.interp(pos, np.arange(N), L)
R = np.interp(pos, np.arange(N), R)
hiss = signal.lfilter(*signal.butter(2, [2500 / (SR / 2), 9000 / (SR / 2)], 'band'), rng.standard_normal((2, N)))
L += hiss[0] * 0.0005  # faint: there, not in the way
R += hiss[1] * 0.0005

# fade in/out edges, soft saturation, normalise
fade = np.clip(tt / 1.5, 0, 1) * np.clip((N / SR - tt) / 6.0, 0, 1)
L *= fade
R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L = np.tanh(1.25 * L / peak) / np.tanh(1.25)
R = np.tanh(1.25 * R / peak) / np.tanh(1.25)
pcm = (np.stack([L, R], 1) * 0.89 * 32767).astype(np.int16)
out = sys.argv[1] if len(sys.argv) > 1 else 'canon.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, f'{N / SR:.1f}s')
