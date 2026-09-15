"""Builds the edit spec for lesson 0-1 from its whisper transcript: which source ranges to keep (retakes dropped,
long pauses tightened) and where the on-screen cards land. Run, then: python ../render_lesson.py 0-1.spec.json
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(os.environ.get("TEMP", HERE), "ryv-lesson01")
segs = json.load(open(os.path.join(HERE, "0-1.transcript.json"), encoding="utf-8"))
words = [w for s in segs for w in s["words"]]

def at(phrase, after=0.0):
    """Source time of the first word of `phrase` in the transcript."""
    toks = phrase.lower().split()
    for i in range(len(words)):
        if words[i]["s"] < after: continue
        if [w["w"].strip().lower().strip(",.") for w in words[i:i + len(toks)]] == toks: return words[i]["s"]
    raise SystemExit("not found: " + phrase)

# Source-time ranges to keep, in order. Everything between them is a retake, a stumble or a pause we don't need.
KEEP = [(0.60, 17.2), (21.5, 49.6), (53.2, 58.2), (66.88, 78.6), (79.1, 84.9), (96.7, 122.7), (123.5, 125.6), (128.9, 161.4),
        (163.2, 185.95), (190.8, 199.5), (199.6, 218.9), (221.3, 236.6), (237.1, 248.3), (249.9, 263.9), (266.2, 282.6),
        (286.8, 300.8), (302.2, 313.2), (315.2, 340.8), (342.5, 350.2), (355.6, 372.0), (375.4, 406.4), (407.8, 412.0),
        (420.1, 437.6), (437.9, 444.1), (459.2, 461.3)]
GAP = 0.10   # matches render_lesson.build_audio

def out_t(src):
    acc = 0.0
    for a, b in KEEP:
        if src < a: return acc
        if src <= b: return acc + (src - a)
        acc += (b - a) + GAP
    return acc

chapters = [(0.6, "Cold open"), (79.1, "How the course works"), (163.2, "The one habit"), (249.9, "What Mythic actually takes"), (342.5, "What happens next"), (407.8, "Homework")]
cards = [(at("each one costs"), "5 small things × 1 fight a game", 8, False), (at("8 modules"), "8 modules · 15 lessons", 6, False),
         (at("every lesson has"), "Video · Reading · Homework", 8, False), (at("here's the rule"), "Don't start the next lesson until the homework is done.", 8, False),
         (at("answer one question"), "What got me killed?", 7, True), (at("one sentence in"), "One sentence per game", 7, False),
         (at("three things"), "Lose fewer free fights. Take fewer bad fights. Survive longer.", 12, False),
         (at("placement pays"), "Top 3 with 2 kills beats 10 kills and an early death.", 9, False), (at("when every lesson"), "8 modules → 1-on-1 with Ryvoki", 8, False),
         (at("we don't stop"), "Mythic, or the coaching continues.", 7, True), (at("play five ranked"), "Start your death log · 5 games · 5 sentences", 10, False)]
quotes = [(at("i peaked with"), "\"I peeked with no cover.\"", at("i pushed a") - at("i peaked with") - 0.05),
          (at("i pushed a"), "\"I pushed a fight while a third squad was audible.\"", at("i stopped moving") - at("i pushed a") - 0.05),
          (at("i stopped moving"), "\"I stopped moving to reload.\"", 2.4)]

spec = dict(audio=os.path.join(WORK, "audio48k.wav"), keep=KEEP, lead=2.5, tail=4.5,
            title="How this course works and what 'Mythic' really takes", module="Module 00 · Setup & Foundations", lesson="Lesson 1 of 15",
            chapters=[dict(at=out_t(t), title=n) for t, n in chapters],
            cards=[dict(at=out_t(t), text=x, hold=h, gradient=g) for t, x, h, g in cards],
            quotes=[dict(at=out_t(t), text=x, hold=h) for t, x, h in quotes],
            homework=dict(title="Start your death log", target="5 games · 5 sentences"), next="Settings that stop fighting you",
            out=os.path.join(os.path.expanduser("~"), "Desktop", "Lesson 0-1 - How this course works.mp4"))
json.dump(spec, open(os.path.join(HERE, "0-1.spec.json"), "w", encoding="utf-8"), indent=1)
kept = sum(b - a for a, b in KEEP)
print(f"kept {kept:.1f}s of source; output {kept + GAP * len(KEEP) + spec['lead'] + spec['tail']:.1f}s -> 0-1.spec.json")
