# Integrated loudness of the game's tracks, to level a new one against the others:
#   python3 tools/music/loudness.py public/music/*.mp3      (pip install miniaudio numpy scipy)
# ITU-R BS.1770-4: K-weighting, 400 ms blocks, 75% overlap, -70 LUFS absolute and -10 LU
# relative gates, with the biquads recomputed for the sample rate.
import sys, math, miniaudio, numpy as np
from scipy.signal import lfilter
def kweight(fs):
    # stage 1: high shelf (+4 dB above ~1.5 kHz)
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = math.tan(math.pi * f0 / fs); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    # stage 2: RLB high-pass (~38 Hz)
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = math.tan(math.pi * f0 / fs)
    a2 = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    b2 = [1, -2, 1]
    return (b1, a1), (b2, a2)
def lufs(path):
    d = miniaudio.decode_file(path, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=2, sample_rate=48000)
    fs = 48000
    x = np.frombuffer(d.samples, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    (b1, a1), (b2, a2) = kweight(fs)
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
    blk, hop = int(0.4 * fs), int(0.1 * fs)
    z = np.array([np.mean(y[i:i + blk] ** 2, axis=0).sum() for i in range(0, len(y) - blk, hop)])
    L = -0.691 + 10 * np.log10(z + 1e-15)
    z1 = z[L > -70]
    rel = -0.691 + 10 * np.log10(z1.mean()) - 10
    z2 = z1[(-0.691 + 10 * np.log10(z1)) > rel]
    return -0.691 + 10 * np.log10(z2.mean()), len(x) / fs
for p in sys.argv[1:]:
    v, dur = lufs(p)
    print(f'{p.split("/")[-1]:18s} {v:6.1f} LUFS  {dur:5.0f} s')
