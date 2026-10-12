# How much a track moves, in numbers, for tracks no one here can listen to (12 Oct: a generated
# Dark track went in as "a steady low drone" and the player found it "monotonous AF"):
#   python3 tools/music/movement.py public/music/*.mp3      (pip install miniaudio numpy)
# For each track:
#   top     the share of its pitch energy on its one strongest note (55 Hz to 2 kHz, 12 classes);
#           a drone is high
#   chroma  how much its harmony moves: the mean cosine distance between the 12-note profiles of
#           consecutive 2 s windows
#   notes   onsets a minute: peaks of the spectral flux over a moving threshold (new notes, hits)
#   level   the spread of its loudness over 2 s windows, in dB
# The tracks the player has liked (12 Oct): Dusk I and II and the title at a 20 to 25% top, 0.10
# to 0.14 chroma and 113 to 201 notes a minute; Black Hole I, the ending and the arranged Canon at
# 20 to 23%, 0.27 to 0.33 and 11 to 31. The drones: Dark I 78%, 0.001, 4; Degenerate II 70%,
# 0.001, 40; Black Hole II 56%, 0.005, 5. A new track that should move wants a top under about
# 35% and a chroma over about 0.1; and the player hears it before it goes in.
import sys
import miniaudio
import numpy as np

SR = 16000


def movement(path):
    d = miniaudio.decode_file(path, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1, sample_rate=SR)
    m = np.frombuffer(d.samples, dtype=np.float32).astype(np.float64)
    n, hop = 4096, 1024
    win = np.hanning(n)
    f = np.fft.rfftfreq(n, 1 / SR)
    band = (f > 55) & (f < 2000)
    pc = ((np.round(12 * np.log2(f[band] / 440)) + 9) % 12).astype(int)
    S = np.array([np.abs(np.fft.rfft(m[i:i + n] * win)) for i in range(0, len(m) - n, hop)])
    per = int(2 * SR / hop)
    profiles, levels = [], []
    for k in range(0, len(S) - per, per):
        c = np.zeros(12)
        np.add.at(c, pc, (S[k:k + per][:, band] ** 2).sum(0))
        profiles.append(c / (c.sum() + 1e-12))
        levels.append(10 * np.log10((S[k:k + per] ** 2).sum() + 1e-12))
    profiles = np.array(profiles)
    total = profiles.sum(0)
    top = total.max() / total.sum()
    chroma = np.mean([1 - (a @ b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12) for a, b in zip(profiles[:-1], profiles[1:])])
    flux = np.maximum(0, np.diff(np.log1p(S), axis=0)).sum(1)
    thr = np.convolve(flux, np.ones(43) / 43, mode='same') * 1.5 + 1e-9
    onsets = sum(1 for i in range(1, len(flux) - 1) if flux[i] > thr[i] and flux[i] >= flux[i - 1] and flux[i] > flux[i + 1])
    return top, chroma, onsets / (len(m) / SR / 60), np.std(levels)


for p in sys.argv[1:]:
    top, chroma, notes, level = movement(p)
    print(f"{p.split('/')[-1]:<20} top {top * 100:4.0f}%  chroma {chroma:.3f}  notes {notes:5.0f}/min  level ±{level:4.1f} dB")
