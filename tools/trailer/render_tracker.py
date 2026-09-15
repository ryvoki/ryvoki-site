"""Renders the Blood Strike Rank Tracker trailer (1920x1080, 60 fps) from real overlay captures + brand assets.

    python capture_tracker.py          first: captures the overlay + panel at 4x (needs Chrome)
    python render_tracker.py           full render -> Desktop\\Ryvoki-Rank-Tracker-Trailer.mp4
    python render_tracker.py --preview key frames -> tools/trailer/preview-tracker/*.png
"""
import math, os, random, sys
from PIL import Image, ImageDraw
from lib import *  # noqa: F401,F403

DUR = 39.0
CAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "captures")
def cap(name, box): return Image.open(os.path.join(CAP, name + ".png")).convert("RGBA").crop(box)
OV = {k: cap("overlay-" + k, (0, 0, 1440, 360)) for k in ("master-4350-7", "master-4350-8", "master-4410-8", "legend-4610-8", "mythic-5240-12")}
PANEL = {k: cap("panel-" + k, (0, 0, 1440, 1192)) for k in ("master-7", "master-8-press", "legend-8")}
# regions inside the 360x90 overlay (CSS px): badge column, RP block, wins box
R_BADGE, R_RP, R_WINS = (10, 8, 92, 82), (103, 14, 262, 76), (272, 14, 350, 76)

_ov_cache = {}
def overlay(c, key, cx, cy, width, alpha=1.0, glow=0.35):
    """Draws a captured overlay state centred at (cx, cy) with the given on-screen width. Returns its rect.
    The aura and shadow are built from the card's own alpha, so they hug its shape instead of forming a box."""
    from PIL import ImageFilter
    ck = (key, int(width))
    if ck not in _ov_cache:
        s = width / 360; im = OV[key].resize((max(2, int(1440 * s / 4)), max(2, int(360 * s / 4))), Image.LANCZOS)
        pad = 100; a_ = im.getchannel("A")
        def aura(color, blur):
            tint = Image.new("RGBA", im.size, color + (255,)); tint.putalpha(a_)
            big = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0)); big.paste(tint, (pad, pad))
            return big.filter(ImageFilter.GaussianBlur(blur))
        _ov_cache[ck] = (im, aura((255, 90, 60), 58), aura((0, 0, 0), 34))
    im, halo, shadow = _ov_cache[ck]
    x, y = cx - im.width / 2, cy - im.height / 2
    if glow:
        paste(c, with_alpha(shadow, alpha * 0.85), x - 100, y - 100 + 30)
        paste(c, with_alpha(halo, alpha * glow * 0.8), x - 100, y - 100)
    paste(c, with_alpha(im, alpha), x, y)
    return (x, y, im.width / 1440 * 4)

def region_flash(c, rect, region, t, at, color, dur=0.9):
    """Soft coloured pulse over one overlay region (rect from overlay()) starting at `at`."""
    if not (at <= t < at + dur): return
    x, y, s = rect; a = (1 - seg(t, at, at + dur)) ** 1.4
    rx0, ry0, rx1, ry1 = [v * s for v in region]
    from PIL import ImageFilter
    box = rounded((int(rx1 - rx0) + 40, int(ry1 - ry0) + 40), 18, color + (int(70 * a),)).filter(ImageFilter.GaussianBlur(18))
    paste(c, box, x + rx0 - 20, y + ry0 - 20)

def rising_label(c, text, x, y, t, at, color=GREEN, dur=1.3):
    if not (at <= t < at + dur): return
    p = seg(t, at, at + dur)
    blit(c, text_layer(text, font("display", 40, 900), color), x, y - 70 * ease_out_cubic(p), alpha=(1 - p) ** 0.8, glow=18, glow_color=color)

# ----------------------------------------------------------------------------- scenes
def scene_hook(c, t):    # 2.5 - 7.5
    f = font("display", 150, 900)
    slam(c, text_layer("YOUR RANK.", f, WHITE), W / 2, H / 2 - 200, t, 0.1, glow=30)
    slam(c, text_layer("ON STREAM.", f, WHITE), W / 2, H / 2 - 20, t, 0.75, glow=30)
    slam(c, text_layer("LIVE.", f, WHITE, gradient=True), W / 2, H / 2 + 160, t, 1.4, glow=44, gradient_glow=EMBER2)
    fade_up(c, text_layer("Stop retyping a text source every time you rank up.", font("body", 42, 500), MUTED), W / 2, H / 2 + 330, t, 2.4, dur=0.5, rise=24)

def draw_stream_mock(c, t, z, pivot):
    """A stylised stream layout (no gameplay): scene frame, cam box, chat, LIVE pill, and the real overlay top-left.
    z = zoom factor about `pivot` (screen point that stays fixed)."""
    px, py = pivot
    def T(x, y): return (px + (x - px) * z, py + (y - py) * z)
    def S(v): return v * z
    # scene frame
    fx0, fy0, fx1, fy1 = 180, 96, 1740, 972
    (ax, ay), (bx, by) = T(fx0, fy0), T(fx1, fy1)
    frame = rounded((max(2, int(bx - ax)), max(2, int(by - ay))), int(S(22)), (13, 15, 19, 255), outline=(255, 255, 255, 30), width=max(1, int(S(2))))
    paste(c, frame, ax, ay)
    # inner glow + faint diagonal streaks to read as "a scene"
    glow = ORB.resize((int(S(1400)), int(S(1400))), Image.BILINEAR)
    gx, gy = T(1150, 620); paste(c, with_alpha(glow, 0.35), gx - glow.width / 2, gy - glow.height / 2)
    for i in range(6):
        sx, sy = T(fx0 + 200 + i * 240, fy0 + 40)
        streak = rounded((max(2, int(S(90))), max(2, int(S(760)))), int(S(20)), (255, 255, 255, 6))
        paste(c, streak.rotate(18, expand=True, resample=Image.BILINEAR), sx, sy)
    # cam box
    (cx0, cy0), (cx1, cy1) = T(fx0 + 28, fy1 - 28 - 176), T(fx0 + 28 + 312, fy1 - 28)
    cam = rounded((max(2, int(cx1 - cx0)), max(2, int(cy1 - cy0))), int(S(14)), (20, 23, 28, 255), outline=(255, 255, 255, 40), width=max(1, int(S(2))))
    paste(c, cam, cx0, cy0)
    m = MARK.resize((max(2, int(S(90))), max(2, int(S(78)))), Image.LANCZOS); mx, my = T(fx0 + 28 + 156, fy1 - 28 - 88)
    paste(c, with_alpha(m, 0.35), mx - m.width / 2, my - m.height / 2)
    lab = text_layer("CAM", font("mono", 20, 700), DIM, spacing=3); lx, ly = T(fx0 + 60, fy1 - 60)
    blit(c, lab, lx, ly, scale=z, alpha=0.9)
    # chat column
    (chx0, chy0), (chx1, chy1) = T(fx1 - 28 - 340, fy0 + 28), T(fx1 - 28, fy1 - 28)
    chat = rounded((max(2, int(chx1 - chx0)), max(2, int(chy1 - chy0))), int(S(14)), (17, 20, 25, 235), outline=(255, 255, 255, 30), width=max(1, int(S(2))))
    paste(c, chat, chx0, chy0)
    lines = [("kyro", "what rank are you now"), ("nova_", "W"), ("Dex", "that overlay is clean"), ("mira", "how many wins today"), ("sam", "gg"), ("kyro", "+1 today lets go")]
    for i, (who, msg) in enumerate(lines):
        show = seg(t, 0.4 + i * 0.45, 0.6 + i * 0.45)
        if show <= 0: continue
        who_l = text_layer(who, font("body", 22, 700), (255, 160, 120)); msg_l = text_layer(msg, font("body", 22, 500), (200, 205, 212))
        y = fy0 + 28 + 40 + i * 46; x = fx1 - 28 - 340 + 22
        wx, wy = T(x, y); blit(c, who_l, wx + who_l.width * z / 2, wy, scale=z, alpha=show)
        mx_, my_ = T(x + who_l.width * 0.9 + 10, y); blit(c, msg_l, mx_ + msg_l.width * z / 2, my_, scale=z, alpha=show)
    # LIVE pill
    lp = rounded((150, 46), 23, (255, 61, 61, 235)); d = ImageDraw.Draw(lp); d.ellipse((16, 17, 28, 29), fill=(255, 255, 255, 255)); d.text((40, 10), "LIVE", font=font("body", 22, 700), fill=(255, 255, 255, 255)); d.text((98, 10), "1.2K", font=font("body", 22, 500), fill=(255, 220, 210, 255))
    lx, ly = T(fx1 - 28 - 340 - 24 - 75, fy0 + 28 + 23); blit(c, lp, lx, ly, scale=z)
    # the real overlay, top-left of the scene
    ox, oy = T(fx0 + 28 + 207, fy0 + 28 + 52)
    return overlay(c, "master-4350-7", ox, oy, S(414), glow=0.25)

def scene_stream(c, t):  # 7.5 - 16
    pivot = (180 + 28 + 207, 96 + 28 + 52)
    zoom = lerp(1.0, 3.9, ease_in_out(seg(t, 2.2, 3.6)))
    # after the push-in the scene keeps its pivot on the overlay; then we re-centre the big overlay for the live-update beat
    if t < 3.9:
        draw_stream_mock(c, t, zoom, pivot)
        cap_ = text_layer("A 360×90 card in an OBS Browser Source.", font("body", 40, 500), MUTED)
        fade_up(c, cap_, W / 2, H - 70, t, 0.6, dur=0.5, rise=20, hold_until=2.4)
    else:
        # dissolve from the pushed-in scene to a clean, centred big overlay
        mix = seg(t, 3.9, 4.4)
        if mix < 1:
            draw_stream_mock(c, t, 3.9, pivot)
            c.alpha_composite(Image.new("RGBA", (W, H), (7, 8, 10, int(255 * mix))))
        key = "master-4350-7" if t < 6.0 else ("master-4350-8" if t < 7.4 else "master-4410-8")
        rect = overlay(c, key, W / 2, H / 2 - 40, 1500, alpha=max(mix, 0.001), glow=0.45)
        region_flash(c, rect, R_WINS, t, 6.0, GREEN)
        rising_label(c, "+1", rect[0] + 311 * rect[2], rect[1] + 8 * rect[2], t, 6.0)
        region_flash(c, rect, R_RP, t, 7.4, EMBER2)
        rising_label(c, "+60 RP", rect[0] + 180 * rect[2], rect[1] + 8 * rect[2], t, 7.4, color=GOLD)
        slam(c, text_layer("WINS. RP. RANK.", font("display", 72, 900), WHITE), W / 2, H / 2 + 260, t, 4.5, glow=26)
        fade_up(c, text_layer("Updated the moment you change them. No refresh, no re-adding the source.", font("body", 38, 500), MUTED), W / 2, H / 2 + 350, t, 5.0, dur=0.5, rise=20)

def scene_panel(c, t):   # 16 - 22
    slam(c, text_layer("CHANGE IT HERE.", font("display", 64, 900), WHITE), W / 2 - 480, 150, t, 0.1, glow=24)
    slam(c, text_layer("IT'S LIVE THERE.", font("display", 64, 900), WHITE, gradient=True), W / 2 + 470, 150, t, 0.5, glow=30)
    pk = "master-7" if t < 2.2 else ("master-8-press" if t < 3.8 else "legend-8")
    p = ease_out_back(seg(t, 0.2, 0.8), 1.2)
    panel = PANEL[pk].resize((int(1440 * 0.42), int(1192 * 0.42)), Image.LANCZOS)
    px, py = W / 2 - 480 + (1 - p) * -120, H / 2 + 70
    paste(c, with_alpha(panel, seg(t, 0.2, 0.5)), px - panel.width / 2, py - panel.height / 2)
    ok = "master-4350-7" if t < 2.35 else ("master-4350-8" if t < 3.95 else "legend-4610-8")
    q = ease_out_back(seg(t, 0.5, 1.1), 1.2)
    rect = overlay(c, ok, W / 2 + 470 + (1 - q) * 120, H / 2 + 70, 820, alpha=seg(t, 0.5, 0.8), glow=0.4)
    region_flash(c, rect, R_WINS, t, 2.35, GREEN)
    rising_label(c, "+1", rect[0] + 311 * rect[2], rect[1] + 8 * rect[2], t, 2.35)
    region_flash(c, rect, R_BADGE, t, 3.95, EMBER2, dur=1.1)
    region_flash(c, rect, R_RP, t, 3.95, EMBER2, dur=1.1)
    rising_label(c, "RANK UP", rect[0] + 50 * rect[2], rect[1] + 6 * rect[2], t, 3.95, color=GOLD)
    arrow = text_layer("→", font("body", 120, 700), EMBER2)
    bob = 8 * math.sin(t * 5)
    fade_up(c, arrow, W / 2 - 10 + bob, H / 2 + 60, t, 1.0, dur=0.4, rise=0)
    cue = text_layer("tap  +", font("mono", 26, 700), GREEN, spacing=2); cue2 = text_layer("pick  Legend IV", font("mono", 26, 700), GOLD, spacing=2)
    fade_up(c, cue, px, py + panel.height / 2 + 40, t, 2.2, dur=0.25, rise=10, hold_until=3.8)
    fade_up(c, cue2, px, py + panel.height / 2 + 40, t, 3.8, dur=0.25, rise=10)

FEATURES = [
    ("Transparent 360×90 card", "Drops onto any layout. Nothing behind it but your scene."),
    ("Rank · RP · wins today", "The three numbers chat keeps asking about, always current."),
    ("Instant updates", "Server-sent events. Change a value, the overlay moves."),
    ("Runs fully offline", "Lives on 127.0.0.1. No accounts, no cloud, no logins."),
    ("Never touches the game", "No memory reading, no injection, no telemetry. Just a tracker."),
    ("One EXE, no install", "Self-contained build. Unzip, run, add the source."),
]
def scene_features(c, t): # 22 - 28
    slam(c, text_layer("BUILT FOR THE STREAM.", font("display", 78, 900), WHITE), W / 2, 130, t, 0.05, glow=26)
    cw, ch, gap = 560, 250, 34
    x0 = W / 2 - (3 * cw + 2 * gap) / 2 + cw / 2
    for i, (title, desc) in enumerate(FEATURES):
        r, col = divmod(i, 3); start = 0.45 + i * 0.16
        p = ease_out_back(seg(t, start, start + 0.55), 1.2)
        card = rounded((cw, ch), 22, (0, 0, 0, 110), outline=(255, 255, 255, 40), width=2); d = ImageDraw.Draw(card)
        d.rounded_rectangle((28, 46, 42, 60), radius=3, fill=EMBER2 + (255,))
        d.text((60, 34), title, font=font("display", 28, 800), fill=WHITE + (255,))
        # wrap desc
        words = desc.split(); lines = []; cur = ""
        for w_ in words:
            trial = (cur + " " + w_).strip()
            if font("body", 25, 500).getlength(trial) > cw - 90: lines.append(cur); cur = w_
            else: cur = trial
        lines.append(cur)
        for j, line in enumerate(lines): d.text((60, 100 + j * 36), line, font=font("body", 25, 500), fill=MUTED + (255,))
        cx = x0 + col * (cw + gap); cy = 400 + r * (ch + gap) + 6 * math.sin(t * 1.3 + i)
        blit(c, card, cx, cy + (1 - p) * 80, scale=lerp(0.6, 1.0, p), alpha=seg(t, start, start + 0.25), glow=18, glow_alpha=0.2)

def scene_setup(c, t):    # 28 - 33
    slam(c, text_layer("SETUP IN 60 SECONDS.", font("display", 84, 900), WHITE, gradient=True), W / 2, 170, t, 0.05, glow=34)
    steps = [("01", "Run the EXE.", "Paste your license key once."), ("02", "OBS → Browser Source.", "URL  http://127.0.0.1:8787/overlay   ·   360 × 90"), ("03", "Change rank, RP or wins in the panel.", "Auto-saved. Survives restarts.")]
    for i, (n, title, sub) in enumerate(steps):
        start = 0.7 + i * 0.5; p = ease_out_cubic(seg(t, start, start + 0.5))
        row = rounded((1360, 138), 20, (0, 0, 0, 110), outline=(255, 255, 255, 40), width=2); d = ImageDraw.Draw(row)
        d.text((34, 40), n, font=font("mono", 44, 700), fill=EMBER2 + (255,))
        d.text((130, 26), title, font=font("display", 34, 800), fill=WHITE + (255,))
        d.text((130, 84), sub, font=font("mono", 24, 500), fill=MUTED + (255,))
        blit(c, row, W / 2 + (1 - p) * 140, 380 + i * 180, alpha=p, glow=16, glow_alpha=0.18)

def scene_end(c, t):      # 33 - 39
    fade = 1 - ease_in_cubic(seg(t, 5.2, 5.9))
    wm = WORDMARK.resize((int(1200 * 0.55), int(340 * 0.55)), Image.LANCZOS)
    p = ease_out_cubic(seg(t, 0.05, 0.9))
    blit(c, wm, W / 2, H / 2 - 345, scale=lerp(0.85, 1, p), alpha=p * fade, glow=44, glow_alpha=0.45 * p * fade)
    q = ease_out_cubic(seg(t, 0.3, 1.0))
    overlay(c, "mythic-5240-12", W / 2, H / 2 - 75 + (1 - q) * 40, 880, alpha=q * fade, glow=0.45)
    slam(c, text_layer("$4.99", font("display", 120, 900), WHITE, gradient=True), W / 2 - 300, H / 2 + 150, t, 0.9, glow=40, gradient_glow=EMBER2)
    fade_up(c, text_layer("Blood Strike Rank Tracker", font("body", 42, 700), WHITE), W / 2 + 250, H / 2 + 115, t, 1.2, dur=0.45, rise=18, hold_until=6.0)
    fade_up(c, text_layer("License key instantly · works on 3 PCs", font("body", 32, 500), MUTED), W / 2 + 250, H / 2 + 172, t, 1.35, dur=0.45, rise=18, hold_until=6.0)
    pp = ease_out_back(seg(t, 1.9, 2.5), 1.4)
    blit(c, pill("GET IT AT RYVOKI.COM/PROJECTS", 620), W / 2, H / 2 + 300, scale=lerp(0.6, 1.0, pp) * (1 + 0.012 * math.sin(t * 5)), alpha=seg(t, 1.9, 2.2) * fade, glow=34, glow_alpha=0.6 * fade)
    fade_up(c, text_layer("CRYPTO CHECKOUT  ·  OR ASK IN THE DISCORD", font("mono", 22, 600), MUTED, spacing=4), W / 2, H / 2 + 385, t, 2.6, dur=0.5, rise=12, hold_until=6.0)
    if fade < 1: c.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - fade) * 255))))

SCENES = [(0.0, lambda c, t: scene_intro(c, t, end=2.5)), (2.5, scene_hook), (7.5, scene_stream), (16.0, scene_panel), (22.0, scene_features), (28.0, scene_setup), (33.0, scene_end)]
CUTS = [s for s, _ in SCENES][1:]

def render_frame(t):
    c = background(t, 0.6 if t < 2.5 else 1.0)
    for i, (start, fn) in enumerate(SCENES):
        end = SCENES[i + 1][0] if i + 1 < len(SCENES) else DUR + 1
        if start <= t < end:
            random.seed(int(t * FPS)); fn(c, t - start); break
    c.alpha_composite(VIGNETTE)
    for cut in CUTS: flash(c, t, cut, strength=0.75 if cut in (7.5, 33.0) else 0.5)
    return c

MUSIC = dict(cuts=CUTS, big_cuts=(7.5, 33.0), kick_from=2.5, hat_from=7.5, bass_from=16.0, risers=(5.3, 13.9, 26.0), pad_from=7.5, pad_len=26.0, end_chord_at=33.0)

if __name__ == "__main__":
    preview = "--preview" in sys.argv
    run(render_frame, DUR, os.path.join(DESKTOP, "Ryvoki-Rank-Tracker-Trailer.mp4"), MUSIC,
        preview_times=(1.5, 5.5, 9.0, 11.0, 13.0, 15.0, 17.5, 19.0, 21.0, 25.0, 31.0, 36.5) if preview else None,
        preview_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), "preview-tracker"))
