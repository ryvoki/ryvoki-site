"""Renders the Mythic Course trailer (1920x1080, 60 fps) from the site's brand assets.

    python render.py            full render -> Desktop\Ryvoki-Mythic-Course-Trailer.mp4
    python render.py --preview  key frames only -> tools/trailer/preview-course/*.png (fast QA)
"""
import math, os, random, sys
from PIL import Image, ImageDraw
from lib import *  # noqa: F401,F403  shared toolkit: fonts, text/glow compositing, background, music, encoder

DUR = 47.0
MODULES = [card_image(os.path.join(IMG, "course", f"module-0{i}.png"), size=(432, 243)) for i in range(8)]
MODULE_TITLES = ["Setup & Foundations", "Aim", "Movement", "Game Sense", "Loadouts & Loot", "Ranked Strategy", "Mental Game & Review", "The Mythic Push"]


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
    c = background(t, 0.6 if t < 3 else 1.0)
    for i, (start, fn) in enumerate(SCENES):
        end = SCENES[i + 1][0] if i + 1 < len(SCENES) else DUR + 1
        if start <= t < end:
            random.seed(int(t * FPS)); fn(c, t - start); break
    c.alpha_composite(VIGNETTE)
    for cut in CUTS: flash(c, t, cut, strength=0.8 if cut == 36.0 else 0.5)
    return c

MUSIC = dict(cuts=CUTS, big_cuts=(12.0, 36.0), kick_from=3.0, hat_from=12.0, bass_from=17.0, risers=(9.8, 14.8, 22.8, 33.8), pad_from=12.0, pad_len=35.0, end_chord_at=41.0)

if __name__ == "__main__":
    preview = "--preview" in sys.argv
    run(render_frame, DUR, os.path.join(DESKTOP, "Ryvoki-Mythic-Course-Trailer.mp4"), MUSIC,
        preview_times=(1.6, 3.5, 6.9, 9.9, 15.2, 20.0, 23.6, 27.0, 30.0, 34.0, 38.5, 44.5) if preview else None,
        preview_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), "preview-course"))
