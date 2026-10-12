# A darker remix of a recorded track, for a later age (12 Oct: the player, of the Dusk's third
# track, "for Dark a darker remix of it may be good"). Krea's music models take words only, so a
# remix of the same music is made here:
#   python3 tools/music/darken.py in.mp3 out.wav [semitones 4] [low-pass Hz 3000] [reverb s 6] [wet 0.35]
#   (pip install miniaudio numpy scipy)
# - slower and lower together, as a tape played slow: down by the given semitones (4 turns 64 BPM
#   in A minor into about 51 BPM in F minor);
# - its brightness taken off with a low-pass, 12 dB an octave;
# - a long dark reverb: decaying noise, itself low-passed, mixed under the dry sound.
# Then make it loop and set its level with loop-track.py, check it with movement.py, and let the
# player hear it before it goes in.
import sys
import wave
from fractions import Fraction
import miniaudio
import numpy as np
from scipy.signal import butter, oaconvolve, resample_poly, sosfilt

SR = 48000


def darken(src, dst, semitones=4.0, cutoff=3000.0, rt60=6.0, wet=0.35):
    d = miniaudio.decode_file(src, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=2, sample_rate=SR)
    x = np.frombuffer(d.samples, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    # more samples played at the same rate: slower, and lower by the same ratio
    ratio = Fraction(2 ** (semitones / 12)).limit_denominator(200)
    y = resample_poly(x, ratio.numerator, ratio.denominator, axis=0)
    y = sosfilt(butter(2, cutoff, 'low', fs=SR, output='sos'), y, axis=0)
    # the reverb: a fixed seed, so the same arguments make the same file
    rng = np.random.default_rng(1)
    n = int(rt60 * 1.2 * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-6.91 * t / rt60)[:, None]
    ir = sosfilt(butter(2, 2500, 'low', fs=SR, output='sos'), ir, axis=0)
    ir /= np.sqrt(np.sum(ir ** 2, axis=0))
    ir = np.concatenate([np.zeros((int(0.03 * SR), 2)), ir])
    rev = np.stack([oaconvolve(y[:, c], ir[:, c]) for c in range(2)], axis=1)
    out = wet * rev
    out[:len(y)] += (1 - wet) * y
    out *= 10 ** (-1 / 20) / np.max(np.abs(out))
    with wave.open(dst, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((out * 32767).astype('<i2').tobytes())
    print(f'{dst.split("/")[-1]}: {semitones:g} semitones down (speed {ratio.denominator}/{ratio.numerator}), '
          f'low-pass {cutoff:g} Hz, reverb {rt60:g} s at {wet:g}; {len(x) / SR:.0f} s -> {len(out) / SR:.0f} s')


if __name__ == '__main__':
    a = sys.argv[1:]
    darken(a[0], a[1], *(float(v) for v in a[2:6]))
