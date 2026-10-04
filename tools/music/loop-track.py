# Make a generated track loop cleanly: trim its fade-in and fade-out, crossfade the end into the
# start (equal power), set its level, and encode as the game's other tracks (MP3 192 kbps, 48 kHz).
#   python3 tools/music/loop-track.py 'in.mp3|public/music/out.mp3|<RMS dBFS>|<crossfade s>' ...
# A crossfade of 0 only trims and levels: for a track that plays in turn with others, which the
# game fades out and in itself.
import sys, miniaudio, numpy as np, lameenc
def process(src, dst, target_rms_db, xfade_s):
    d = miniaudio.decode_file(src, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=2, sample_rate=48000)
    sr = 48000
    x = np.frombuffer(d.samples, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    mono = x.mean(axis=1)
    hop = sr // 2
    env = np.array([np.sqrt(np.mean(mono[i:i + hop] ** 2)) + 1e-9 for i in range(0, len(mono) - hop, hop)])
    edb = 20 * np.log10(env)
    med = np.median(edb)
    lim = int(12 * sr / hop)
    head = next((i for i in range(min(lim, len(edb))) if edb[i] >= med - 8), 0)
    tail = next((len(edb) - 1 - i for i in range(min(lim, len(edb))) if edb[len(edb) - 1 - i] >= med - 8), len(edb) - 1)
    y = x[head * hop:(tail + 1) * hop]
    L = int(xfade_s * sr)
    if L > 0:
        t = np.linspace(0, 1, L)[:, None]
        mix = y[-L:] * np.cos(t * np.pi / 2) + y[:L] * np.sin(t * np.pi / 2)
        out = np.concatenate([y[L:-L], mix])
    else:
        out = y
    rms = np.sqrt(np.mean(out ** 2))
    gain = 10 ** (target_rms_db / 20) / rms
    peak = np.max(np.abs(out)) * gain
    if peak > 10 ** (-1.5 / 20): gain *= 10 ** (-1.5 / 20) / peak
    out = np.clip(out * gain, -1, 1)
    enc = lameenc.Encoder()
    enc.set_bit_rate(192); enc.set_in_sample_rate(sr); enc.set_channels(2); enc.set_quality(2)
    pcm = (out * 32767).astype('<i2').tobytes()
    data = enc.encode(pcm) + enc.flush()
    open(dst, 'wb').write(data)
    o = out.mean(axis=1)
    j = lambda a: 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)
    print(f'{dst.split("/")[-1]}: trimmed {head * 0.5:.1f} s from the start and {(len(edb) - 1 - tail) * 0.5:.1f} s from the end, {len(out) / sr:.0f} s long, RMS {j(o):.1f} dBFS (gain {20 * np.log10(gain):+.1f} dB), peak {20 * np.log10(np.max(np.abs(out))):.1f} dBFS; loop join {j(o[-sr:]):.0f} -> {j(o[:sr]):.0f} dBFS; {len(data) / 1e6:.2f} MB')
for arg in sys.argv[1:]:
    src, dst, rms, xf = arg.split('|')
    process(src, dst, float(rms), float(xf))
