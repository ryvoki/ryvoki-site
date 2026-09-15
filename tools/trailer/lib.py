"""Shared trailer toolkit: brand fonts/colours, text + glow compositing, animated background, music bed, encoder loop.

Used by render.py (Mythic course trailer) and render_tracker.py (Rank Tracker trailer).
"""
import math, os, random, subprocess, time, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1920, 1080, 60
ROOT = r"C:\Users\austi\Desktop\ryvoki-site"
IMG = os.path.join(ROOT, "public", "assets", "img")
FONTS = os.path.join(ROOT, "tools", "trailer", "fonts")
DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop")

EMBER, EMBER2, GOLD = (255, 61, 61), (255, 122, 47), (255, 181, 71)
WHITE, MUTED, DIM, BG = (242, 243, 245), (142, 149, 160), (93, 99, 109), (7, 8, 10)
GREEN = (127, 217, 163)
GRAD = (EMBER, EMBER2, GOLD)

# ----------------------------------------------------------------------------- easing
clamp = lambda v, a=0.0, b=1.0: max(a, min(b, v))
def seg(t, a, b): return clamp((t - a) / (b - a)) if b > a else 1.0
def ease_out_expo(p): p = clamp(p); return 1.0 if p >= 1 else 1 - 2 ** (-10 * p)
def ease_out_back(p, s=1.6): p = clamp(p) - 1; return 1 + p * p * ((s + 1) * p + s)
def ease_in_out(p): p = clamp(p); return p * p * (3 - 2 * p)
def ease_out_cubic(p): p = clamp(p); return 1 - (1 - p) ** 3
def ease_in_cubic(p): p = clamp(p); return p ** 3
def lerp(a, b, p): return a + (b - a) * p

# ----------------------------------------------------------------------------- text
_font_cache = {}
def font(kind, size, weight=None):
    key = (kind, size, weight)
    if key not in _font_cache:
        path = {"display": "Unbounded.ttf", "body": "SpaceGrotesk.ttf", "mono": "JetBrainsMono.ttf"}[kind]
        f = ImageFont.truetype(os.path.join(FONTS, path), size)
        if weight is not None: f.set_variation_by_axes([weight])
        _font_cache[key] = f
    return _font_cache[key]

def gradient_strip(w, h, stops=GRAD):
    xs = np.linspace(0, 1, w, dtype=np.float32)
    c0, c1, c2 = (np.array(c, np.float32) for c in stops)
    out = np.zeros((w, 3), np.float32)
    m = xs < 0.55
    out[m] = c0 + (c1 - c0) * (xs[m] / 0.55)[:, None]
    out[~m] = c1 + (c2 - c1) * ((xs[~m] - 0.55) / 0.45)[:, None]
    strip = np.repeat(out[None, :, :], h, axis=0).astype(np.uint8)
    return Image.fromarray(strip, "RGB").convert("RGBA")

_layer_cache = {}
def text_layer(text, f, fill=WHITE, spacing=0, gradient=False):
    key = ("t", text, id(f), fill, spacing, gradient)
    if key in _layer_cache: return _layer_cache[key]
    widths = [f.getlength(ch) for ch in text]
    w = int(sum(widths) + spacing * max(0, len(text) - 1)) if spacing else int(f.getlength(text))
    asc, desc = f.getmetrics(); h = asc + desc; pad = 10
    img = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    if spacing:
        x = pad
        for ch, cw in zip(text, widths): d.text((x, pad), ch, font=f, fill=fill + (255,)); x += cw + spacing
    else:
        d.text((pad, pad), text, font=f, fill=fill + (255,))
    if gradient:
        strip = gradient_strip(img.width, img.height); strip.putalpha(img.getchannel("A")); img = strip
    _layer_cache[key] = img
    return img

_glow_cache = {}
def glow_of(layer, radius=28, color=EMBER):
    key = (id(layer), radius, color)
    if key in _glow_cache: return _glow_cache[key]
    pad = radius * 3
    tint = Image.new("RGBA", layer.size, color + (255,)); tint.putalpha(layer.getchannel("A"))
    big = Image.new("RGBA", (layer.width + pad * 2, layer.height + pad * 2), (0, 0, 0, 0))
    big.paste(tint, (pad, pad))
    big = big.filter(ImageFilter.GaussianBlur(radius))
    _glow_cache[key] = big
    return big

def paste(canvas, src, x, y):
    """alpha_composite with clipping so partly off-screen layers are fine."""
    x, y = int(x), int(y)
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(src.width, W - x), min(src.height, H - y)
    if sx1 <= sx0 or sy1 <= sy0: return
    part = src if (sx0 == 0 and sy0 == 0 and sx1 == src.width and sy1 == src.height) else src.crop((sx0, sy0, sx1, sy1))
    canvas.alpha_composite(part, (x + sx0, y + sy0))

_alpha_luts = {}
def with_alpha(img, alpha):
    if alpha >= 0.999: return img
    a = int(alpha * 255)
    lut = _alpha_luts.get(a)
    if lut is None: lut = _alpha_luts[a] = [v * a // 255 for v in range(256)]
    out = img.copy(); out.putalpha(img.getchannel("A").point(lut)); return out

def blit(canvas, layer, cx, cy, scale=1.0, alpha=1.0, glow=0, glow_color=EMBER, glow_alpha=None, rot=0):
    if alpha <= 0.003 or scale <= 0.01: return
    if glow:
        g = glow_of(layer, glow, glow_color)
        gs = g if scale == 1.0 else g.resize((max(1, int(g.width * scale)), max(1, int(g.height * scale))), Image.BILINEAR)
        ga = alpha if glow_alpha is None else glow_alpha
        paste(canvas, with_alpha(gs, ga), cx - gs.width / 2, cy - gs.height / 2)
    ls = layer if scale == 1.0 else layer.resize((max(1, int(layer.width * scale)), max(1, int(layer.height * scale))), Image.LANCZOS if scale < 1 else Image.BICUBIC)
    if rot: ls = ls.rotate(rot, resample=Image.BICUBIC, expand=True)
    paste(canvas, with_alpha(ls, alpha), cx - ls.width / 2, cy - ls.height / 2)

def slam(canvas, layer, cx, cy, t, start, hold_until=None, glow=34, base_scale=1.0, gradient_glow=EMBER):
    """Text slams in at `start`: scales 1.7->1 with expo ease, fades in over 0.12 s, small shake on landing, glow decays."""
    if t < start: return
    p = seg(t, start, start + 0.38)
    sc = lerp(1.7, 1.0, ease_out_expo(p)) * base_scale
    al = seg(t, start, start + 0.12)
    if hold_until is not None: al *= 1 - ease_in_cubic(seg(t, hold_until - 0.18, hold_until))
    if al <= 0: return
    shake = (1 - p) * 10
    dx, dy = random.uniform(-shake, shake), random.uniform(-shake, shake)
    ga = lerp(1.0, 0.45, ease_out_cubic(seg(t, start + 0.1, start + 1.2)))
    blit(canvas, layer, cx + dx, cy + dy, scale=sc, alpha=al, glow=glow, glow_color=gradient_glow, glow_alpha=al * ga)

def fade_up(canvas, layer, cx, cy, t, start, dur=0.5, rise=40, hold_until=None, glow=0, glow_color=EMBER):
    if t < start: return
    p = ease_out_cubic(seg(t, start, start + dur))
    al = p
    if hold_until is not None: al *= 1 - ease_in_cubic(seg(t, hold_until - 0.25, hold_until))
    blit(canvas, layer, cx, cy + (1 - p) * rise, alpha=al, glow=glow, glow_color=glow_color, glow_alpha=al * 0.5)

def rounded(size, radius, fill, outline=None, width=2):
    img = Image.new("RGBA", size, (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill, outline=outline, width=width)
    return img

def load_rgba(path, size=None):
    im = Image.open(path).convert("RGBA")
    if size: im = im.resize(size, Image.LANCZOS)
    return im

def card_image(path, size=(400, 225), radius=18):
    im = Image.open(path).convert("RGBA").resize(size, Image.LANCZOS)
    mask = Image.new("L", size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    im.putalpha(mask)
    frame = rounded(size, radius, (0, 0, 0, 0), outline=(255, 255, 255, 40), width=2)
    im.alpha_composite(frame)
    return im

def pill(text, width=560, height=92, f=None, fill=(255, 92, 58, 255)):
    f = f or font("body", 34, 700)
    img = rounded((width, height), height // 2, fill); d = ImageDraw.Draw(img)
    d.text(((width - f.getlength(text)) / 2, (height - 44) / 2), text, font=f, fill=(255, 255, 255, 255))
    return img

# ----------------------------------------------------------------------------- shared assets
MARK = load_rgba(os.path.join(IMG, "brand", "mark.png"))
WORDMARK = load_rgba(os.path.join(IMG, "brand", "wordmark.png"))
BADGE = {k: load_rgba(os.path.join(IMG, f"rank-{k}.png")) for k in ("master", "legend", "legend1", "mythic")}

# ----------------------------------------------------------------------------- background
def radial(w, h, cx, cy, rx, ry, color, strength):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    d = ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2
    a = np.clip(1 - np.sqrt(d), 0, 1) ** 2 * strength
    return a[:, :, None] * np.array(color, np.float32)

def _build_background():
    base = np.zeros((H, W, 3), np.float32) + np.array(BG, np.float32)
    base += radial(W, H, W / 2, -120, 900, 520, EMBER, 0.24)
    base += radial(W, H, W * 0.9, H * 0.1, 700, 400, EMBER2, 0.10)
    base += radial(W, H, W * 0.15, H * 0.95, 700, 300, EMBER, 0.06)
    noise = np.random.default_rng(3).normal(0, 3.2, (H, W, 1)).astype(np.float32)
    return Image.fromarray(np.clip(base + noise, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

def _build_grid():
    step = 56; big = Image.new("RGBA", (W + step, H + step), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    for x in range(0, big.width, step): d.line((x, 0, x, big.height), fill=(255, 255, 255, 255), width=1)
    for y in range(0, big.height, step): d.line((0, y, big.width, y), fill=(255, 255, 255, 255), width=1)
    fade = radial(W, H, W / 2, 0, 1150, 720, (1, 1, 1), 1.0)[:, :, 0]
    return big, Image.fromarray(np.clip(fade * 0.11 * 255, 0, 255).astype(np.uint8), "L")

def _build_orb():
    s = 900; ys, xs = np.mgrid[0:s, 0:s].astype(np.float32)
    d = np.sqrt((xs - s / 2) ** 2 + (ys - s / 2) ** 2) / (s / 2)
    a = np.clip(1 - d, 0, 1) ** 2.2 * 0.55
    rgb = np.zeros((s, s, 4), np.float32); rgb[:, :, 0] = 255; rgb[:, :, 1] = 90; rgb[:, :, 2] = 60; rgb[:, :, 3] = a * 255
    return Image.fromarray(rgb.astype(np.uint8), "RGBA")

def _build_vignette():
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xs - W / 2) / (W / 2)) ** 2 + ((ys - H / 2) / (H / 2)) ** 2)
    a = np.clip((d - 0.55) / 0.9, 0, 1) ** 1.6 * 0.72
    v = np.zeros((H, W, 4), np.uint8); v[:, :, 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(v, "RGBA")

def _spark_sprite(size, color):
    s = size * 4; img = Image.new("RGBA", (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.ellipse((s / 2 - size / 2, s / 2 - size / 2, s / 2 + size / 2, s / 2 + size / 2), fill=color + (255,))
    return img.filter(ImageFilter.GaussianBlur(size * 0.6))

random.seed(7)
BG_IMG = _build_background()
GRID_BIG, GRID_FADE = _build_grid()
ORB = _build_orb()
VIGNETTE = _build_vignette()
SPARKS = [_spark_sprite(s, c) for s in (3, 4, 6) for c in (EMBER, EMBER2, GOLD)]
PARTICLES = [dict(x=random.uniform(0, W), y=random.uniform(0, H), vy=random.uniform(18, 70), vx=random.uniform(-12, 12), ph=random.uniform(0, 6.28), sp=random.choice(SPARKS), a=random.uniform(0.35, 0.9)) for _ in range(90)]

def background(t, energy=1.0):
    canvas = BG_IMG.copy()
    ox, oy = int((t * 9) % 56), int((t * 4) % 56)
    grid = GRID_BIG.crop((56 - ox, 56 - oy, 56 - ox + W, 56 - oy + H)).copy(); grid.putalpha(GRID_FADE)
    canvas.alpha_composite(grid)
    orb_x = W / 2 + 220 * math.sin(t * 0.35); orb_y = -160 + 70 * math.sin(t * 0.21 + 1)
    paste(canvas, with_alpha(ORB, 0.75 * energy), orb_x - ORB.width / 2, orb_y - ORB.height / 2)
    for p in PARTICLES:
        y = (p["y"] - p["vy"] * t) % (H + 60) - 30
        x = (p["x"] + p["vx"] * t + 14 * math.sin(t * 0.9 + p["ph"])) % (W + 40) - 20
        a = p["a"] * (0.55 + 0.45 * math.sin(t * 2.3 + p["ph"])) * energy
        sp = p["sp"]; paste(canvas, with_alpha(sp, a), x - sp.width / 2, y - sp.height / 2)
    return canvas

def flash(canvas, t, at, strength=0.55, dur=0.22, color=(255, 150, 110)):
    if at <= t < at + dur:
        a = strength * (1 - seg(t, at, at + dur)) ** 1.5
        canvas.alpha_composite(Image.new("RGBA", (W, H), color + (int(a * 255),)))

def scene_intro(c, t, label="RYVOKI PRESENTS", end=3.0):
    mark = MARK.resize((int(512 * 0.5), int(442 * 0.5)), Image.LANCZOS)
    p = ease_out_cubic(seg(t, 0.2, 1.4))
    pulse = 0.5 + 0.5 * math.sin(t * 3.0)
    blit(c, mark, W / 2, H / 2 - 40, scale=lerp(0.6, 1.0, p), alpha=p * (1 - ease_in_cubic(seg(t, end - 0.45, end - 0.05))), glow=40, glow_alpha=p * (0.35 + 0.4 * pulse))
    fade_up(c, text_layer(label, font("mono", 30, 600), MUTED, spacing=14), W / 2, H / 2 + 150, t, 0.7, dur=0.7, rise=20, hold_until=end - 0.05)

# ----------------------------------------------------------------------------- music
def make_music(path, dur, cuts, big_cuts=(), kick_from=3.0, hat_from=12.0, bass_from=17.0, risers=(), pad_from=12.0, pad_len=35.0, end_chord_at=None, bpm=96):
    SR = 44100; N = int(dur * SR); mix = np.zeros(N, np.float32); tt = np.arange(N) / SR
    rng = np.random.default_rng(11)
    def add(sig, at, gain=1.0):
        i = int(at * SR); n = min(len(sig), N - i)
        if n > 0: mix[i:i + n] += sig[:n].astype(np.float32) * gain
    def lowpass(sig, cutoff):
        spec = np.fft.rfft(sig); freqs = np.fft.rfftfreq(len(sig), 1 / SR)
        spec *= 1 / (1 + (freqs / cutoff) ** 4); return np.fft.irfft(spec, len(sig))
    def kick(d=0.4):
        t = np.arange(int(d * SR)) / SR; f = 42 + 110 * np.exp(-t * 28)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + rng.normal(0, 1, len(t)) * np.exp(-t * 90) * 0.35
    def hat(d=0.06):
        t = np.arange(int(d * SR)) / SR; n = rng.normal(0, 1, len(t)) * np.exp(-t * 70)
        return n - lowpass(n, 5000)
    def impact(d=1.8):
        t = np.arange(int(d * SR)) / SR
        boom = np.sin(2 * np.pi * (34 + 60 * np.exp(-t * 6)) * t) * np.exp(-t * 2.4)
        crack = lowpass(rng.normal(0, 1, len(t)), 2500) * np.exp(-t * 5.5) * 0.9
        return boom * 1.3 + crack
    def riser(d=2.2):
        t = np.arange(int(d * SR)) / SR; r = (t / d) ** 2.2
        n = rng.normal(0, 1, len(t)); dark = lowpass(n, 350); bright = n - lowpass(n, 1800)
        return (dark * (1 - r) + bright * r) * r * 0.9 + np.sin(2 * np.pi * (60 + 340 * r) * t) * r * 0.25
    def pad_note(freq, d, detune=0.004):
        t = np.arange(int(d * SR)) / SR; out = np.zeros(len(t))
        for dt in (-detune, 0, detune):
            ph = 2 * np.pi * freq * (1 + dt) * t
            out += sum(np.sin(k * ph) / k for k in range(1, 7))
        env = np.minimum(t / 2.5, 1) * np.minimum((d - t) / 2.5, 1)
        return lowpass(out, 700) * np.clip(env, 0, 1) * 0.08
    drone = sum(np.sin(2 * np.pi * 55 * k * tt) / (k * 1.4) for k in range(1, 6)) + 0.8 * np.sin(2 * np.pi * 27.5 * tt)
    mix += (lowpass(drone, 260) * (0.55 + 0.25 * np.sin(2 * np.pi * 0.11 * tt)) * 0.10).astype(np.float32)
    for f in (110.0, 130.81, 164.81): add(pad_note(f, pad_len), pad_from)
    if end_chord_at is not None:
        for f in (98.0, 116.54, 146.83): add(pad_note(f, dur - end_chord_at), end_chord_at, 0.9)
    beat = 60 / bpm; last = end_chord_at if end_chord_at is not None else dur - 1
    b = kick_from
    while b < last:
        add(kick(), b, 0.55 if b < hat_from else (0.8 if b < bass_from else 1.0)); b += beat
    b = hat_from + beat / 2
    while b < last: add(hat(), b, 0.22 if int((b - hat_from) / beat) % 2 == 0 else 0.14); b += beat / 2
    b = bass_from
    while b < last:
        t = np.arange(int(0.45 * SR)) / SR; add(np.sin(2 * np.pi * 55 * t) * np.exp(-t * 5) * 0.55, b); b += beat
    for at in cuts: add(impact(), at, 1.25 if at in big_cuts else 0.9)
    for at in risers: add(riser(), at, 0.6)
    fade_in = np.minimum(tt / 0.6, 1); fade_out = np.clip((dur - tt) / 2.2, 0, 1)
    mix = np.tanh(mix * 1.15) * 0.92 * fade_in * fade_out
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.column_stack([pcm, pcm]).tobytes())

# ----------------------------------------------------------------------------- driver
def run(render_frame, dur, out_path, music, preview_times=None, preview_dir=None):
    """`render_frame(t) -> RGBA image`; `music` is a dict of make_music kwargs. Preview mode writes PNGs and returns."""
    if preview_times:
        os.makedirs(preview_dir, exist_ok=True)
        for t in preview_times:
            render_frame(t).convert("RGB").save(os.path.join(preview_dir, f"t{t:05.1f}.png")); print("frame", t)
        return
    wav = out_path + ".wav"; print("music..."); make_music(wav, dur, **music)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
           "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out_path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(dur * FPS); t0 = time.time()
    for i in range(total):
        p.stdin.write(render_frame(i / FPS).convert("RGB").tobytes())
        if i % (FPS * 5) == 0: print(f"{i / total * 100:5.1f}%  {time.time() - t0:5.0f}s", flush=True)
    p.stdin.close(); p.wait(); os.remove(wav)
    print("done:", out_path, f"({os.path.getsize(out_path) / 1048576:.1f} MB) in {time.time() - t0:.0f}s")
