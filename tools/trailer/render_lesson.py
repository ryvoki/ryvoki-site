"""Turns a voice recording + an edit spec into a finished course lesson video (1080p30, brand visuals, cards on cue).

    python render_lesson.py spec.json

spec.json:
{
  "audio": "C:/.../audio48k.wav",            # source recording (any ffmpeg-readable file)
  "keep": [[start, end], ...],                # source-time ranges to keep, in order (retakes/mistakes are simply left out)
  "lead": 2.5, "tail": 4.0,                   # seconds of silence before the voice starts / after it ends
  "title": "How this course works and what 'Mythic' really takes",
  "module": "Module 00 · Setup & Foundations", "lesson": "Lesson 1 of 15",
  "chapters": [{"at": 0.0, "title": "Cold open"}, ...],          # output-time seconds (voice time, lead added automatically)
  "cards": [{"at": 12.3, "text": "5 small things × 1 fight a game", "hold": 8}, ...],
  "quotes": [{"at": 40.0, "text": "\"I peeked with no cover.\"", "hold": 4}, ...],   # smaller, italic-feel lines
  "homework": {"title": "Start your death log", "target": "5 games · 5 sentences"},
  "next": "Settings that stop fighting you",
  "out": "C:/Users/austi/Desktop/Lesson 0-1.mp4"
}
"""
import json, math, os, subprocess, sys, time
import numpy as np
from PIL import Image, ImageDraw
from lib import *  # noqa: F401,F403

FPS_OUT = 30

def load_wav(path):
    """Decode any input to float32 stereo 48 kHz via ffmpeg."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", "48000", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2)

def build_audio(spec, work):
    """Cuts the recording to the kept ranges with tiny fades, adds lead/tail silence, then cleans and normalises it with ffmpeg."""
    sr = 48000; src = load_wav(spec["audio"])
    fade = int(0.012 * sr); ramp = np.linspace(0, 1, fade, dtype=np.float32)[:, None]
    parts = [np.zeros((int(spec.get("lead", 2.5) * sr), 2), np.float32)]
    for a, b in spec["keep"]:
        seg = src[int(a * sr):int(b * sr)].copy()
        if len(seg) > 2 * fade: seg[:fade] *= ramp; seg[-fade:] *= ramp[::-1]
        parts.append(seg); parts.append(np.zeros((int(0.10 * sr), 2), np.float32))   # a natural 100 ms breath between takes
    parts.append(np.zeros((int(spec.get("tail", 4.0) * sr), 2), np.float32))
    cut = np.concatenate(parts)
    raw_path = os.path.join(work, "cut_raw.wav"); clean_path = os.path.join(work, "cut_clean.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(sr), "-i", "-", raw_path], input=cut.tobytes(), check=True)
    # voice chain: rumble cut, gentle noise reduction, de-esser-ish tilt, compression, broadcast loudness
    chain = "highpass=f=80,afftdn=nf=-28:nr=12,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=4,loudnorm=I=-16:TP=-1.5:LRA=9"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw_path, "-af", chain, "-ar", str(sr), clean_path], check=True)
    return clean_path, len(cut) / sr

def envelope(path, fps):
    """Per-frame loudness (0..1) of the finished voice track, for the reactive glow."""
    a = load_wav(path).mean(axis=1); n = 48000 // fps
    frames = len(a) // n; rms = np.sqrt((a[:frames * n].reshape(frames, n) ** 2).mean(axis=1))
    env = np.clip(rms / (np.percentile(rms, 97) + 1e-6), 0, 1)
    sm = np.copy(env)
    for i in range(1, len(sm)): sm[i] = max(env[i], sm[i - 1] * 0.86)
    return sm

def main(spec_path):
    spec = json.load(open(spec_path, encoding="utf-8"))
    work = os.path.dirname(os.path.abspath(spec_path))
    print("audio..."); voice, dur = build_audio(spec, work); env = envelope(voice, FPS_OUT)
    lead = spec.get("lead", 2.5)
    cards = [dict(c, at=c["at"] + lead) for c in spec.get("cards", [])]
    quotes = [dict(q, at=q["at"] + lead) for q in spec.get("quotes", [])]
    chapters = [dict(c, at=c["at"] + lead) for c in spec.get("chapters", [])]
    mark_small = MARK.resize((64, 55), Image.LANCZOS); mark_big = MARK.resize((256, 221), Image.LANCZOS)
    f_title = font("display", 68, 900); f_card = font("display", 64, 900); f_quote = font("body", 46, 500)
    f_eyebrow = font("mono", 24, 600); f_chapter = font("body", 28, 600); f_small = font("body", 26, 500)

    def wrap(text, f, max_w):
        words = text.split(); lines = []; cur = ""
        for w_ in words:
            trial = (cur + " " + w_).strip()
            if f.getlength(trial) > max_w and cur: lines.append(cur); cur = w_
            else: cur = trial
        if cur: lines.append(cur)
        return lines

    def draw_lines(c, lines, f, cy, t, start, fill=WHITE, gradient=False, glow=26, gap=14, hold_until=None):
        h = f.getmetrics()[0] + f.getmetrics()[1]
        total = len(lines) * h + (len(lines) - 1) * gap; y = cy - total / 2 + h / 2
        for i, line in enumerate(lines):
            slam(c, text_layer(line, f, fill, gradient=gradient and i == len(lines) - 1), W / 2, y + i * (h + gap), t, start + i * 0.08, hold_until=hold_until, glow=glow)

    def frame(i):
        t = i / FPS_OUT; e = env[i] if i < len(env) else 0.0
        c = background(t, 0.55)
        # persistent chrome: mark with voice-reactive glow, eyebrow, progress bar, chapter
        blit(c, mark_small, 92, 72, glow=30, glow_alpha=0.25 + 0.6 * e)
        blit(c, text_layer(f"MYTHIC COURSE  ·  {spec['module'].upper()}  ·  {spec['lesson'].upper()}", f_eyebrow, MUTED, spacing=3), 150 + 560, 72, alpha=0.9)
        chap = next((ch for ch in reversed(chapters) if t >= ch["at"]), None)
        if chap:
            lab = text_layer(chap["title"].upper(), f_chapter, (201, 206, 214), spacing=2)
            fade_up(c, lab, 60 + lab.width / 2, H - 78, t, chap["at"], dur=0.4, rise=12)
        bar = Image.new("RGBA", (W - 120, 4), (255, 255, 255, 40)); c.alpha_composite(bar, (60, H - 44))
        p = min(1, t / dur); c.alpha_composite(gradient_strip(max(1, int((W - 120) * p)), 4), (60, H - 44))
        # opening title (before the voice) and closing card (after it)
        voice_start, voice_end = lead, dur - spec.get("tail", 4.0)
        if t < voice_start + 1.2:
            a = 1 - ease_in_cubic(seg(t, voice_start + 0.4, voice_start + 1.2))
            blit(c, mark_big, W / 2, H / 2 - 190, alpha=a * ease_out_cubic(seg(t, 0.1, 0.9)), glow=40, glow_alpha=0.5 * a)
            for k, line in enumerate(wrap(spec["title"], f_title, 1500)):
                blit(c, text_layer(line, f_title, WHITE), W / 2, H / 2 + 20 + k * 84, alpha=a * ease_out_cubic(seg(t, 0.3 + k * 0.1, 1.0 + k * 0.1)), glow=26, glow_alpha=0.4 * a)
            blit(c, text_layer("with Ryvoki", f_small, MUTED), W / 2, H / 2 + 20 + len(wrap(spec["title"], f_title, 1500)) * 84 + 10, alpha=a * ease_out_cubic(seg(t, 0.8, 1.4)))
        elif t >= voice_end - 0.2:
            a = ease_out_cubic(seg(t, voice_end - 0.2, voice_end + 0.6)) * (1 - ease_in_cubic(seg(t, dur - 0.7, dur - 0.05)))
            hw = spec.get("homework", {})
            blit(c, text_layer("HOMEWORK", f_eyebrow, GOLD, spacing=6), W / 2, H / 2 - 150, alpha=a)
            blit(c, text_layer(hw.get("title", ""), f_card, WHITE), W / 2, H / 2 - 70, alpha=a, glow=26, glow_alpha=0.4 * a)
            blit(c, text_layer(hw.get("target", ""), font("mono", 32, 700), GOLD, spacing=2), W / 2, H / 2 + 20, alpha=a, glow=16, glow_color=GOLD, glow_alpha=0.4 * a)
            if spec.get("next"): blit(c, text_layer("Next: " + spec["next"], f_small, MUTED), W / 2, H / 2 + 130, alpha=a)
        else:
            # active card or quote, else the lesson title sits quietly in the middle
            card = next((cd for cd in reversed(cards) if cd["at"] <= t < cd["at"] + cd.get("hold", 8)), None)
            quote = next((q for q in reversed(quotes) if q["at"] <= t < q["at"] + q.get("hold", 5)), None)
            if card:
                lines = wrap(card["text"], f_card, 1500)
                draw_lines(c, lines, f_card, H / 2 - 10, t, card["at"], gradient=card.get("gradient", False), hold_until=card["at"] + card.get("hold", 8))
            elif quote:
                lines = wrap(quote["text"], f_quote, 1400)
                draw_lines(c, lines, f_quote, H / 2 - 10, t, quote["at"], fill=(226, 230, 236), glow=14, gap=10, hold_until=quote["at"] + quote.get("hold", 5))
            else:
                last_end = max([cd["at"] + cd.get("hold", 8) for cd in cards if cd["at"] <= t] + [q["at"] + q.get("hold", 5) for q in quotes if q["at"] <= t] + [voice_start + 1.2])
                a = ease_out_cubic(seg(t, last_end, last_end + 0.6))
                for k, line in enumerate(wrap(spec["title"], font("display", 44, 800), 1300)):
                    blit(c, text_layer(line, font("display", 44, 800), (120, 126, 136)), W / 2, H / 2 - 20 + k * 60, alpha=0.9 * a)
        c.alpha_composite(VIGNETTE)
        return c

    total = int(dur * FPS_OUT); out = spec["out"]; t0 = time.time()
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS_OUT), "-i", "-", "-i", voice,
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]
    if "--preview" in sys.argv:
        pdir = os.path.join(work, "preview"); os.makedirs(pdir, exist_ok=True)
        for tt in spec.get("preview_times", [1.0, lead + 1, lead + 20, dur - 2]):
            frame(int(tt * FPS_OUT)).convert("RGB").save(os.path.join(pdir, f"t{tt:06.1f}.png")); print("frame", tt)
        return
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(total):
        p.stdin.write(frame(i).convert("RGB").tobytes())
        if i % (FPS_OUT * 30) == 0: print(f"{i / total * 100:5.1f}%  {time.time() - t0:5.0f}s", flush=True)
    p.stdin.close(); p.wait()
    print("done:", out, f"({os.path.getsize(out) / 1048576:.1f} MB, {dur:.0f}s) in {time.time() - t0:.0f}s")

if __name__ == "__main__":
    main(sys.argv[1])
