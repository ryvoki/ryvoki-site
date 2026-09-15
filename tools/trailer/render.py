"""Renders the Mythic Course trailer (1920x1080, 60 fps) from the site's brand assets.

    python render.py            full render -> Desktop\\Ryvoki Course Trailer\\Ryvoki-Mythic-Course-Trailer.mp4
    python render.py --preview  key frames only -> Desktop\\Ryvoki Course Trailer\\frames\\*.png (fast QA)

Everything is drawn with Pillow; ffmpeg encodes. Fonts are the site's (Unbounded, Space Grotesk, JetBrains Mono, OFL).
"""
import math, os, random, subprocess, sys, time, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1920, 1080, 60
DUR = 47.0
ROOT = r"C:\Users\austi\Desktop\ryvoki-site"
IMG = os.path.join(ROOT, "public", "assets", "img")
FONTS = os.path.join(ROOT, "tools", "trailer", "fonts")
OUT_DIR = os.path.join(os.path.expanduser("~"), "Desktop", "Ryvoki Course Trailer")
os.makedirs(OUT_DIR, exist_ok=True)

EMBER, EMBER2, GOLD = (255, 61, 61), (255, 122, 47), (255, 181, 71)
WHITE, MUTED, DIM, BG = (242, 243, 245), (142, 149, 160), (93, 99, 109), (7, 8, 10)
GRAD = (EMBER, EMBER2, GOLD)
random.seed(7)

# ----------------------------------------------------------------------------- helpers
clamp = lambda v, a=0.0, b=1.0: max(a, min(b, v))
def seg(t, a, b): return clamp((t - a) / (b - a)) if b > a else 1.0
def ease_out_expo(p): p = clamp(p); return 1.0 if p >= 1 else 1 - 2 ** (-10 * p)
def ease_out_back(p, s=1.6): p = clamp(p) - 1; return 1 + p * p * ((s + 1) * p + s)
def ease_in_out(p): p = clamp(p); return p * p * (3 - 2 * p)
def ease_out_cubic(p): p = clamp(p); return 1 - (1 - p) ** 3
def ease_in_cubic(p): p = clamp(p); return p ** 3
def lerp(a, b, p): return a + (b - a) * p

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

# ----------------------------------------------------------------------------- assets
MARK = load_rgba(os.path.join(IMG, "brand", "mark.png"))
WORDMARK = load_rgba(os.path.join(IMG, "brand", "wordmark.png"))
BADGE = {k: load_rgba(os.path.join(IMG, f"rank-{k}.png")) for k in ("master", "legend", "legend1", "mythic")}
MODULES = [card_image(os.path.join(IMG, "course", f"module-0{i}.png"), size=(432, 243)) for i in range(8)]
MODULE_TITLES = ["Setup & Foundations", "Aim", "Movement", "Game Sense", "Loadouts & Loot", "Ranked Strategy", "Mental Game & Review", "The Mythic Push"]

# ----------------------------------------------------------------------------- background
def radial(w, h, cx, cy, rx, ry, color, strength):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    d = ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2
    a = np.clip(1 - np.sqrt(d), 0, 1) ** 2 * strength
    return a[:, :, None] * np.array(color, np.float32)

def build_background():
    base = np.zeros((H, W, 3), np.float32) + np.array(BG, np.float32)
    base += radial(W, H, W / 2, -120, 900, 520, EMBER, 0.24)
    base += radial(W, H, W * 0.9, H * 0.1, 700, 400, EMBER2, 0.10)
    base += radial(W, H, W * 0.15, H * 0.95, 700, 300, EMBER, 0.06)
    noise = np.random.default_rng(3).normal(0, 3.2, (H, W, 1)).astype(np.float32)
    base = np.clip(base + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(base, "RGB").convert("RGBA")
BG_IMG = build_background()

def build_grid():
    step = 56; big = Image.new("RGBA", (W + step, H + step), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    for x in range(0, big.width, step): d.line((x, 0, x, big.height), fill=(255, 255, 255, 255), width=1)
    for y in range(0, big.height, step): d.line((0, y, big.width, y), fill=(255, 255, 255, 255), width=1)
    fade = radial(W, H, W / 2, 0, 1150, 720, (1, 1, 1), 1.0)[:, :, 0]
    fade = np.clip(fade * 0.11 * 255, 0, 255).astype(np.uint8)
    return big, Image.fromarray(fade, "L")
GRID_BIG, GRID_FADE = build_grid()

def build_orb():
    s = 900; ys, xs = np.mgrid[0:s, 0:s].astype(np.float32)
    d = np.sqrt((xs - s / 2) ** 2 + (ys - s / 2) ** 2) / (s / 2)
    a = np.clip(1 - d, 0, 1) ** 2.2 * 0.55
    rgb = np.zeros((s, s, 4), np.float32); rgb[:, :, 0] = 255; rgb[:, :, 1] = 90; rgb[:, :, 2] = 60; rgb[:, :, 3] = a * 255
    return Image.fromarray(rgb.astype(np.uint8), "RGBA")
ORB = build_orb()

def build_vignette():
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xs - W / 2) / (W / 2)) ** 2 + ((ys - H / 2) / (H / 2)) ** 2)
    a = np.clip((d - 0.55) / 0.9, 0, 1) ** 1.6 * 0.72
    v = np.zeros((H, W, 4), np.uint8); v[:, :, 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(v, "RGBA")
VIGNETTE = build_vignette()

def spark_sprite(size, color):
    s = size * 4; img = Image.new("RGBA", (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.ellipse((s / 2 - size / 2, s / 2 - size / 2, s / 2 + size / 2, s / 2 + size / 2), fill=color + (255,))
    return img.filter(ImageFilter.GaussianBlur(size * 0.6))
SPARKS = [spark_sprite(s, c) for s in (3, 4, 6) for c in (EMBER, EMBER2, GOLD)]
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

# ----------------------------------------------------------------------------- scenes
def scene_intro(c, t):   # 0 - 3.0
    mark = MARK.resize((int(512 * 0.5), int(442 * 0.5)), Image.LANCZOS)
    p = ease_out_cubic(seg(t, 0.2, 1.4))
    pulse = 0.5 + 0.5 * math.sin(t * 3.0)
    blit(c, mark, W / 2, H / 2 - 40, scale=lerp(0.6, 1.0, p), alpha=p * (1 - ease_in_cubic(seg(t, 2.55, 2.95))), glow=40, glow_alpha=p * (0.35 + 0.4 * pulse))
    lab = text_layer("RYVOKI PRESENTS", font("mono", 30, 600), MUTED, spacing=14)
    fade_up(c, lab, W / 2, H / 2 + 150, t, 0.7, dur=0.7, rise=20, hold_until=2.95)

def scene_hook(c, t):    # 3.0 - 8.0  (t local)
    f_small = font("body", 54, 600); f_big = font("display", 200, 900)
    fade_up(c, text_layer("STUCK IN", f_small, MUTED, spacing=6), W / 2, H / 2 - 200, t, 0.0, dur=0.35, rise=20, hold_until=3.4)
    ranks = [("GOLD.", 0.15), ("PLATINUM.", 0.95), ("DIAMOND.", 1.75), ("MASTER.", 2.55)]
    for i, (word, start) in enumerate(ranks):
        end = ranks[i + 1][1] if i + 1 < len(ranks) else 3.4
        slam(c, text_layer(word, f_big, WHITE), W / 2, H / 2 + 10, t, start, hold_until=end)
    line = text_layer("SAME LOBBY. SAME DEATHS.", font("display", 78, 800), WHITE)
    slam(c, line, W / 2, H / 2, t, 3.6, glow=30)
    sub = text_layer("Every single season.", font("body", 44, 500), MUTED)
    fade_up(c, sub, W / 2, H / 2 + 110, t, 4.1, dur=0.5, rise=24)

def scene_not_aim(c, t): # 8.0 - 12.0
    slam(c, text_layer("IT'S NOT YOUR AIM.", font("display", 128, 900), WHITE), W / 2, H / 2 - 70, t, 0.05, glow=34)
    sub1 = text_layer("It's five small things that each cost you", font("body", 46, 500), (201, 206, 214))
    sub2 = text_layer("one fight a game.", font("body", 46, 700), GOLD)
    fade_up(c, sub1, W / 2, H / 2 + 80, t, 1.1, dur=0.55, rise=26)
    fade_up(c, sub2, W / 2, H / 2 + 145, t, 1.45, dur=0.55, rise=26, glow=18, glow_color=GOLD)

def scene_ranks(c, t):   # 12.0 - 17.0
    keys = ["master", "legend", "mythic"]; sizes = [300, 340, 420]; xs = [W / 2 - 520, W / 2, W / 2 + 540]
    for i, (k, s, x) in enumerate(zip(keys, sizes, xs)):
        start = 0.1 + i * 0.32
        p = ease_out_back(seg(t, start, start + 0.6))
        bob = 8 * math.sin(t * 1.8 + i)
        blit(c, BADGE[k].resize((s, s), Image.LANCZOS), x, H / 2 - 20 + (1 - p) * 140 + bob, scale=lerp(0.4, 1.0, p), alpha=seg(t, start, start + 0.25), glow=46, glow_color=(EMBER if i < 2 else GOLD), glow_alpha=0.55 + 0.25 * math.sin(t * 3 + i))
    arrow = text_layer("→", font("body", 110, 700), EMBER2)
    for j, x in enumerate([W / 2 - 260, W / 2 + 270]):
        fade_up(c, arrow, x + 6 * math.sin(t * 4 + j), H / 2 - 20, t, 0.9 + j * 0.2, dur=0.35, rise=0)
    slam(c, text_layer("ANY RANK  →  MYTHIC.", font("display", 104, 900), WHITE, gradient=True), W / 2, H / 2 + 330, t, 1.6, glow=36)
    lab = text_layer("FULL COURSE  ·  1-ON-1 COACHING", font("mono", 28, 600), MUTED, spacing=8)
    fade_up(c, lab, W / 2, H / 2 - 330, t, 2.3, dur=0.5, rise=16)

def scene_modules(c, t): # 17.0 - 25.0
    cw, ch, gap = 432, 243, 34
    x0 = W / 2 - (4 * cw + 3 * gap) / 2 + cw / 2
    title = text_layer("8 MODULES  ·  15 LESSONS", font("display", 64, 900), WHITE)
    slam(c, title, W / 2, 150, t, 0.05, glow=26)
    for i, card in enumerate(MODULES):
        r, col = divmod(i, 4)
        start = 0.5 + i * 0.16
        p = ease_out_back(seg(t, start, start + 0.6), 1.3)
        drift = 6 * math.sin(t * 1.2 + i * 0.7)
        cx = x0 + col * (cw + gap); cy = 440 + r * (ch + gap + 12) + drift
        blit(c, card, cx, cy + (1 - p) * 90, scale=lerp(0.55, 1.0, p), alpha=seg(t, start, start + 0.25), glow=22, glow_alpha=0.25 * seg(t, start, start + 0.6))
    if t > 5.0:
        scrim = Image.new("RGBA", (W, H), (7, 8, 10, int(200 * ease_out_cubic(seg(t, 5.0, 5.5)))))
        c.alpha_composite(scrim)
        slam(c, text_layer("HOMEWORK THAT GOES INTO", font("display", 76, 900), WHITE), W / 2, H / 2 - 60, t, 5.15, glow=24)
        slam(c, text_layer("YOUR RANKED GAMES.", font("display", 76, 900), WHITE, gradient=True), W / 2, H / 2 + 50, t, 5.55, glow=30)
        fade_up(c, text_layer("Not just videos. Reading, drills and a target for every lesson.", font("body", 40, 500), MUTED), W / 2, H / 2 + 170, t, 6.1, dur=0.5, rise=22)

def draw_choice(size, label, hint, on):
    img = rounded(size, 16, (0, 0, 0, 80) if not on else (255, 61, 61, 42), outline=(255, 122, 47, 230) if on else (255, 255, 255, 45), width=2)
    d = ImageDraw.Draw(img)
    d.ellipse((24, size[1] / 2 - 11, 46, size[1] / 2 + 11), outline=(255, 122, 47, 255) if on else (255, 255, 255, 70), width=2, fill=(255, 122, 47, 255) if on else None)
    d.text((66, 18), label, font=font("body", 30, 700), fill=WHITE + (255,))
    if hint: d.text((66, 56), hint, font=font("body", 22, 500), fill=MUTED + (255,))
    return img

def scene_intake(c, t):  # 25.0 - 31.0
    card_w, card_h = 980, 640
    p = ease_out_back(seg(t, 0.05, 0.6), 1.2)
    card = rounded((card_w, card_h), 28, (18, 20, 26, 235), outline=(255, 255, 255, 40), width=2)
    d = ImageDraw.Draw(card)
    phase2 = t >= 3.2
    if not phase2:
        d.text((44, 36), "QUESTION 2 OF 12", font=font("mono", 20, 600), fill=MUTED + (255,))
        d.text((44, 68), "What do you play on?", font=font("display", 44, 800), fill=WHITE + (255,))
        picked = 1 if t >= 1.9 else -1
        opts = [("PC", "Mouse and keyboard"), ("Phone", "Touch controls"), ("Tablet / iPad", "Touch controls, bigger screen"), ("Controller", "On any device")]
        for i, (lab, hint) in enumerate(opts):
            row = draw_choice((card_w - 88, 86), lab, hint, i == picked)
            card.alpha_composite(row, (44, 146 + i * 94))
    else:
        d.text((44, 36), "QUESTION 6 OF 12", font=font("mono", 20, 600), fill=MUTED + (255,))
        d.text((44, 68), "How confident are you in your aim?", font=font("display", 40, 800), fill=WHITE + (255,))
        d.text((44, 130), "1 means you lose most 1v1s. 10 means aim is never why you die.", font=font("body", 24, 500), fill=MUTED + (255,))
        picked = 6 if t >= 4.6 else -1
        bw = (card_w - 88 - 9 * 12) / 10
        for n in range(1, 11):
            x = 44 + (n - 1) * (bw + 12); on = n == picked
            cell = rounded((int(bw), int(bw)), 14, (255, 122, 47, 255) if on else (0, 0, 0, 80), outline=None if on else (255, 255, 255, 45), width=2)
            cd = ImageDraw.Draw(cell); tf = font("mono", 34, 700); tw = tf.getlength(str(n))
            cd.text(((bw - tw) / 2, bw / 2 - 22), str(n), font=tf, fill=WHITE + (255,))
            card.alpha_composite(cell, (int(x), 200))
        d.text((44, 330), "Not confident", font=font("body", 22, 500), fill=MUTED + (255,))
        d.text((card_w - 44 - font("body", 22, 500).getlength("Elite"), 330), "Elite", font=font("body", 22, 500), fill=MUTED + (255,))
        btn = rounded((190, 64), 32, (255, 92, 58, 255)); bd = ImageDraw.Draw(btn); bf = font("body", 26, 700)
        bd.text(((190 - bf.getlength("Next")) / 2, 17), "Next", font=bf, fill=(255, 255, 255, 255))
        card.alpha_composite(btn, (card_w - 44 - 190, card_h - 44 - 64))
    if not phase2:
        btn = rounded((190, 64), 32, (255, 92, 58, 255)); bd = ImageDraw.Draw(btn); bf = font("body", 26, 700)
        bd.text(((190 - bf.getlength("Next")) / 2, 17), "Next", font=bf, fill=(255, 255, 255, 255))
        card.alpha_composite(btn, (card_w - 44 - 190, card_h - 44 - 64))
    swap = 1.0
    if 3.0 <= t < 3.2: swap = 1 - seg(t, 3.0, 3.2)
    elif 3.2 <= t < 3.45: swap = seg(t, 3.2, 3.45)
    blit(c, card, W / 2, H / 2 - 30, scale=lerp(0.8, 1.0, p) * lerp(0.97, 1.0, swap), alpha=seg(t, 0.05, 0.3) * swap, glow=40, glow_alpha=0.28)
    cap = text_layer("A PLAN BUILT AROUND YOU.", font("display", 54, 900), WHITE, gradient=True)
    fade_up(c, cap, W / 2, H - 120, t, 0.6, dur=0.5, rise=20, glow=24)
    lab = text_layer("PLATFORM  ·  RANK  ·  CONFIDENCE  ·  HOW OFTEN YOU PLAY", font("mono", 22, 600), MUTED, spacing=4)
    fade_up(c, lab, W / 2, H - 62, t, 1.0, dur=0.5, rise=14)

def scene_coach(c, t):   # 31.0 - 36.0
    mark = MARK.resize((int(512 * 0.42), int(442 * 0.42)), Image.LANCZOS)
    p = ease_out_cubic(seg(t, 0.05, 0.8))
    blit(c, mark, W / 2, H / 2 - 250, scale=lerp(0.7, 1, p), alpha=p, glow=36, glow_alpha=0.5 + 0.2 * math.sin(t * 3))
    slam(c, text_layer("THEN A 1-ON-1 WITH ME.", font("display", 112, 900), WHITE), W / 2, H / 2 + 10, t, 0.35, glow=34)
    fade_up(c, text_layer("I watch you play.", font("body", 50, 500), (201, 206, 214)), W / 2 - 300, H / 2 + 150, t, 1.5, dur=0.5, rise=24)
    fade_up(c, text_layer("You leave with a fix-list.", font("body", 50, 700), GOLD), W / 2 + 250, H / 2 + 150, t, 2.1, dur=0.5, rise=24, glow=16, glow_color=GOLD)

def scene_mythic(c, t):  # 36.0 - 41.0
    b = BADGE["mythic"].resize((720, 720), Image.LANCZOS)
    p = ease_out_cubic(seg(t, 0.0, 1.0))
    blit(c, b, W / 2, H / 2 - 40, scale=lerp(1.5, 1.0, p), alpha=0.32 * p, glow=70, glow_color=GOLD, glow_alpha=0.5 * p)
    slam(c, text_layer("MYTHIC.", font("display", 240, 900), WHITE, gradient=True), W / 2, H / 2 - 60, t, 0.25, glow=48, gradient_glow=GOLD)
    slam(c, text_layer("GUARANTEED.", font("display", 96, 900), WHITE), W / 2, H / 2 + 150, t, 0.85, glow=30)
    fade_up(c, text_layer("Not there by the end of your plan? Coaching continues until you are.", font("body", 38, 500), MUTED), W / 2, H / 2 + 260, t, 1.5, dur=0.5, rise=22)

def scene_end(c, t):     # 41.0 - 47.0
    fade = 1 - ease_in_cubic(seg(t, 5.2, 5.9))
    wm = WORDMARK.resize((int(1200 * 0.62), int(340 * 0.62)), Image.LANCZOS)
    p = ease_out_cubic(seg(t, 0.05, 0.9))
    blit(c, wm, W / 2, H / 2 - 230, scale=lerp(0.85, 1, p), alpha=p * fade, glow=44, glow_alpha=0.45 * p * fade)
    price = text_layer("$30", font("display", 150, 900), WHITE, gradient=True)
    slam(c, price, W / 2 - 250, H / 2 + 20, t, 0.6, glow=40, gradient_glow=EMBER2)
    l1 = text_layer("Full video course", font("body", 44, 700), WHITE)
    l2 = text_layer("+ 1-on-1 coaching", font("body", 44, 700), WHITE)
    l3 = text_layer("Any rank. PC and mobile.", font("body", 34, 500), MUTED)
    fade_up(c, l1, W / 2 + 230, H / 2 - 30, t, 1.0, dur=0.45, rise=18, hold_until=6.0)
    fade_up(c, l2, W / 2 + 230, H / 2 + 28, t, 1.15, dur=0.45, rise=18, hold_until=6.0)
    fade_up(c, l3, W / 2 + 230, H / 2 + 86, t, 1.3, dur=0.45, rise=18, hold_until=6.0)
    pill = rounded((560, 92), 46, (255, 92, 58, 255)); pd = ImageDraw.Draw(pill); pf = font("body", 34, 700)
    txt = "ENROLL AT RYVOKI.COM/COURSE"; pd.text(((560 - pf.getlength(txt)) / 2, 24), txt, font=pf, fill=(255, 255, 255, 255))
    pp = ease_out_back(seg(t, 1.9, 2.5), 1.4)
    blit(c, pill, W / 2, H / 2 + 230, scale=lerp(0.6, 1.0, pp) * (1 + 0.012 * math.sin(t * 5)), alpha=seg(t, 1.9, 2.2) * fade, glow=34, glow_alpha=0.6 * fade)
    lab = text_layer("CRYPTO CHECKOUT  ·  OR ASK IN THE DISCORD", font("mono", 22, 600), MUTED, spacing=4)
    fade_up(c, lab, W / 2, H / 2 + 320, t, 2.6, dur=0.5, rise=12, hold_until=6.0)
    if fade < 1: c.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - fade) * 255))))

SCENES = [(0.0, scene_intro), (3.0, scene_hook), (8.0, scene_not_aim), (12.0, scene_ranks), (17.0, scene_modules), (25.0, scene_intake), (31.0, scene_coach), (36.0, scene_mythic), (41.0, scene_end)]
CUTS = [s for s, _ in SCENES][1:]

def render_frame(t):
    energy = 0.6 if t < 3 else 1.0
    c = background(t, energy)
    for i, (start, fn) in enumerate(SCENES):
        end = SCENES[i + 1][0] if i + 1 < len(SCENES) else DUR + 1
        if start <= t < end:
            random.seed(int(t * FPS))
            fn(c, t - start); break
    c.alpha_composite(VIGNETTE)
    for cut in CUTS: flash(c, t, cut, strength=0.5 if cut not in (36.0,) else 0.8)
    return c

# ----------------------------------------------------------------------------- music
def make_music(path):
    SR = 44100; N = int(DUR * SR); mix = np.zeros(N, np.float32); tt = np.arange(N) / SR
    def add(sig, at, gain=1.0):
        i = int(at * SR); n = min(len(sig), N - i)
        if n > 0: mix[i:i + n] += sig[:n].astype(np.float32) * gain
    def lowpass(sig, cutoff):
        spec = np.fft.rfft(sig); freqs = np.fft.rfftfreq(len(sig), 1 / SR)
        spec *= 1 / (1 + (freqs / cutoff) ** 4); return np.fft.irfft(spec, len(sig))
    def kick(d=0.4):
        t = np.arange(int(d * SR)) / SR; f = 42 + 110 * np.exp(-t * 28)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + np.random.normal(0, 1, len(t)) * np.exp(-t * 90) * 0.35
    def hat(d=0.06):
        t = np.arange(int(d * SR)) / SR; n = np.random.normal(0, 1, len(t)) * np.exp(-t * 70)
        return n - lowpass(n, 5000)
    def impact(d=1.8):
        t = np.arange(int(d * SR)) / SR
        boom = np.sin(2 * np.pi * (34 + 60 * np.exp(-t * 6)) * t) * np.exp(-t * 2.4)
        crack = lowpass(np.random.normal(0, 1, len(t)), 2500) * np.exp(-t * 5.5) * 0.9
        return boom * 1.3 + crack
    def riser(d=2.2):
        t = np.arange(int(d * SR)) / SR; r = (t / d) ** 2.2
        n = np.random.normal(0, 1, len(t)); dark = lowpass(n, 350); bright = n - lowpass(n, 1800)
        return (dark * (1 - r) + bright * r) * r * 0.9 + np.sin(2 * np.pi * (60 + 340 * r) * t) * r * 0.25
    def pad_note(freq, d, detune=0.004):
        t = np.arange(int(d * SR)) / SR; out = np.zeros(len(t))
        for dt in (-detune, 0, detune):
            ph = 2 * np.pi * freq * (1 + dt) * t
            out += sum(np.sin(k * ph) / k for k in range(1, 7))
        env = np.minimum(t / 2.5, 1) * np.minimum((d - t) / 2.5, 1)
        return lowpass(out, 700) * np.clip(env, 0, 1) * 0.08
    # drone
    drone = sum(np.sin(2 * np.pi * 55 * k * tt) / (k * 1.4) for k in range(1, 6)) + 0.8 * np.sin(2 * np.pi * 27.5 * tt)
    drone = lowpass(drone, 260) * (0.55 + 0.25 * np.sin(2 * np.pi * 0.11 * tt)) * 0.10
    mix += drone.astype(np.float32)
    # pad chord from 12 s
    for f in (110.0, 130.81, 164.81): add(pad_note(f, 35), 12.0)
    for f in (98.0, 116.54, 146.83): add(pad_note(f, 6), 41.0, 0.9)
    # kicks 96 bpm from scene 1, growing
    beat = 60 / 96
    b = 3.0
    while b < 41.0:
        gain = 0.55 if b < 12 else (0.8 if b < 25 else 1.0)
        add(kick(), b, gain); b += beat
    b = 12.0 + beat / 2
    while b < 41.0: add(hat(), b, 0.22 if int((b - 12) / beat) % 2 == 0 else 0.14); b += beat / 2
    b = 17.0
    while b < 41.0:
        t = np.arange(int(0.45 * SR)) / SR; add(np.sin(2 * np.pi * 55 * t) * np.exp(-t * 5) * 0.55, b); b += beat
    for at in (3.0, 8.0, 12.0, 17.0, 25.0, 31.0, 36.0, 41.0): add(impact(), at, 1.25 if at in (12.0, 36.0) else 0.9)
    for at in (9.8, 33.8, 14.8, 22.8): add(riser(), at, 0.6)
    # master
    fade_in = np.minimum(tt / 0.6, 1); fade_out = np.clip((DUR - tt) / 2.2, 0, 1)
    mix = np.tanh(mix * 1.15) * 0.92 * fade_in * fade_out
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.column_stack([pcm, pcm]).tobytes())

# ----------------------------------------------------------------------------- main
def preview():
    frames_dir = os.path.join(OUT_DIR, "frames"); os.makedirs(frames_dir, exist_ok=True)
    for t in (1.6, 3.5, 6.9, 9.9, 15.2, 20.0, 23.6, 27.0, 30.0, 34.0, 38.5, 44.5):
        render_frame(t).convert("RGB").save(os.path.join(frames_dir, f"t{t:05.1f}.png"))
        print("frame", t)

def full():
    wav = os.path.join(OUT_DIR, "music.wav"); print("music..."); make_music(wav)
    out = os.path.join(OUT_DIR, "Ryvoki-Mythic-Course-Trailer.mp4")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
           "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(DUR * FPS); t0 = time.time()
    for i in range(total):
        p.stdin.write(render_frame(i / FPS).convert("RGB").tobytes())
        if i % (FPS * 5) == 0: print(f"{i / total * 100:5.1f}%  {time.time() - t0:5.0f}s", flush=True)
    p.stdin.close(); p.wait()
    os.remove(wav)
    print("done:", out, f"({os.path.getsize(out) / 1048576:.1f} MB) in {time.time() - t0:.0f}s")

if __name__ == "__main__":
    preview() if "--preview" in sys.argv else full()
