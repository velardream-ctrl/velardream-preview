"""Reproduce Velar Mask 1.0. Procedural stems only. Python, NumPy, scikit-learn."""
import json
from pathlib import Path
import numpy as np
from sklearn.neural_network import MLPRegressor

RATE = 44100
N = 2048
HOP = 1024
WINDOW = np.sin(np.pi * (np.arange(N) + .5) / N)
BINS = np.arange(N // 2 + 1)
OFFSETS = [-12, -6, -3, -1, 0, 1, 3, 6, 12]


def fixture(seed, seconds=3):
    rng = np.random.default_rng(seed)
    t = np.arange(RATE * seconds) / RATE
    voice = np.zeros_like(t)
    music = np.zeros_like(t)
    for start in np.arange(0, seconds, .32):
        ix = (t >= start) & (t < start + .32)
        u = t[ix] - start
        f = rng.uniform(105, 350)
        phase = np.cumsum(f * (1 + .015 * np.sin(32*u))) * 2*np.pi/RATE
        env = np.sin(np.pi*u/.32)**.6
        formants = [rng.uniform(350, 780), rng.uniform(900, 2300), rng.uniform(2400, 3300)]
        for h in range(1, min(65, int(18000/f))):
            gain = .18/h + sum(np.exp(-((h*f-F)/140)**2) for F in formants)/np.sqrt(h)
            voice[ix] += gain * np.sin(h*phase) * env
    for interval in [0, 4, 7, 12]:
        root = rng.choice([82.4, 98, 110, 130.8, 146.8, 164.8])
        f = root * 2**(interval/12)
        for h in range(1, 14):
            music += np.sin(2*np.pi*f*h*t + rng.uniform(0,6)) / h**1.4
    music *= .5 + .5*np.exp(-5*(t % .48))
    music += .7*rng.standard_normal(len(t))*np.exp(-45*(t % .48))
    return voice/max(abs(voice))*.45, music/max(abs(music))*rng.uniform(.3,.65)


def spectrum(x):
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(x,(HOP,HOP)),N)[::HOP]
    return np.abs(np.fft.rfft(frames * WINDOW))


def features(m):
    history = np.zeros(m.shape[1])
    rows = []
    freq = np.log1p(BINS)/7
    for frame in m:
        log = np.log(frame + .001)
        history = .92*history + .08*frame
        rows.append(np.column_stack([freq, log/6, log-np.log(history+.001)] +
                    [log[np.clip(BINS+d,0,N//2)]-log for d in OFFSETS if d]))
    return np.array(rows)


if __name__ == '__main__':
    rng = np.random.default_rng(218)
    inputs, targets = [], []
    for seed in range(96):
        v, a = fixture(seed)
        V, A, M = map(spectrum, [v,a,v+a])
        ids = rng.choice(M.size, 3200, p=(M+.01).ravel()/np.sum(M+.01))
        inputs.append(features(M).reshape(-1,11)[ids])
        targets.append((V**2/(V**2+A**2+1e-10)).ravel()[ids])
    net = MLPRegressor(hidden_layer_sizes=(20,12), max_iter=45, early_stopping=True,
                       batch_size=512, random_state=218).fit(np.vstack(inputs),np.concatenate(targets))
    path = Path('singer-studio/velar-mask-v1.json')
    path.write_text(json.dumps([dict(w=w.round(7).tolist(), b=b.round(7).tolist())
                               for w,b in zip(net.coefs_, net.intercepts_)], separators=(',',':')))
