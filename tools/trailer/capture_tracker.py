"""Captures the real Rank Tracker overlay (its actual HTML/CSS/JS) and a replica of its control panel at 4x
resolution with transparent backgrounds, using headless Chrome. Output: tools/trailer/captures/*.png

A tiny mock of the tracker's local server serves the overlay files, /api/state, /events and /images/* so the
overlay renders exactly as it does inside OBS.
"""
import http.server, json, os, shutil, socketserver, subprocess, sys, tempfile, threading, urllib.parse

TRACKER = r"C:\Users\austi\Desktop\bloodstrike_tracker"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "captures")
CHROME = next(p for p in [r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"] if os.path.exists(p))
PORT = 8791
STATE = {"rankId": "master_iv", "rankName": "Master IV", "rankPoints": 4350, "winsToday": 7, "imageUrl": "/images/master"}

PANEL_HTML = """<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:transparent}
body{font-family:"Segoe UI",system-ui,sans-serif;color:#ebf0f2;font-size:12px}
.win{width:360px;border:1px solid #303c44;border-radius:8px;overflow:hidden;background:#0f1418;box-shadow:0 18px 50px rgba(0,0,0,.6)}
.title{height:32px;display:flex;align-items:center;gap:8px;padding:0 10px;background:#0f1418;border-bottom:1px solid #1b242a;font-size:12px;color:#c9d2d6}
.title img{width:16px;height:14px}.title .ctl{margin-left:auto;display:flex;gap:16px;color:#9aa8ae;font-size:13px}
.hdr{height:54px;background:#171e23;padding:9px 16px;box-sizing:border-box}
.hdr b{display:block;font-size:14px;font-weight:600;color:#ebf0f2}.hdr span{font-size:11px;color:#8d9aa1}
.lab{position:absolute;font-size:10.3px;font-weight:700;letter-spacing:.4px;color:#8d9aa1}
.body{position:relative;height:168px}
.inp{position:absolute;background:#1c242a;border:1px solid #303c44;color:#ebf0f2;box-sizing:border-box;font-weight:600;font-size:13.5px;display:flex;align-items:center;padding:0 8px}
.btn{position:absolute;background:#1c242a;border:1px solid #303c44;color:#ebf0f2;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:12px}
.btn.press{background:#2a363d;border-color:#6d9b81}
.combo::after{content:"";position:absolute;right:10px;top:9px;border:5px solid transparent;border-top-color:#c9d2d6}
.status{height:44px;background:#171e23;display:flex;align-items:center;gap:8px;padding:0 16px;font-size:11px}
.status .dot{color:#6d9b81}.status b{font-weight:600}.status span{color:#8d9aa1;margin-left:4px}
</style><body><div class="win">
<div class="title"><img src="/mark.png"> Ryvoki Blood Strike Rank Tracker <span class="ctl">&#8212; &#9633; &#10005;</span></div>
<div class="hdr"><b>RYVOKI &nbsp;/&nbsp; RANK TRACKER</b><span>Manual Blood Strike stream utility</span></div>
<div class="body">
<div class="lab" style="left:16px;top:11px">RANK</div>
<div class="inp combo" style="left:16px;top:28px;width:328px;height:27px">__RANK__</div>
<div class="lab" style="left:16px;top:65px">RANKED POINTS</div>
<div class="inp" style="left:16px;top:82px;width:142px;height:25px">__RP__</div>
<div class="lab" style="left:176px;top:65px">WINS TODAY</div>
<div class="btn __PRESSMINUS__" style="left:176px;top:82px;width:34px;height:27px;font-size:16px">&minus;</div>
<div class="inp" style="left:216px;top:82px;width:88px;height:27px">__WINS__</div>
<div class="btn __PRESSPLUS__" style="left:310px;top:82px;width:34px;height:27px;font-size:15px">+</div>
<div class="btn" style="left:16px;top:124px;width:328px;height:30px">Reset Wins Today</div>
</div>
<div class="status"><span class="dot">&#9679;</span><b>Overlay live</b><span>http://127.0.0.1:8787/overlay</span></div>
</div></body>"""

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, body, ctype, status=200):
        if isinstance(body, str): body = body.encode("utf-8")
        self.send_response(status); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        url = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(url.query)
        if url.path.startswith("/overlay/"):
            name = url.path.split("/")[-1]; path = os.path.join(TRACKER, "src", "Overlay", name)
            ctype = {"html": "text/html", "css": "text/css", "js": "application/javascript"}[name.rsplit(".", 1)[-1]]
            return self.send(open(path, "rb").read(), ctype + "; charset=utf-8")
        if url.path == "/api/state": return self.send(json.dumps(STATE), "application/json")
        if url.path == "/events":
            self.send_response(200); self.send_header("Content-Type", "text/event-stream"); self.end_headers()
            self.wfile.write(b"event: state\ndata: " + json.dumps(STATE).encode() + b"\n\n"); self.wfile.flush(); return
        if url.path.startswith("/images/"): return self.send(open(os.path.join(TRACKER, "images", url.path.split("/")[-1]), "rb").read(), "image/png")
        if url.path == "/mark.png": return self.send(open(os.path.join(TRACKER, "assets", "mark.png"), "rb").read(), "image/png")
        if url.path == "/panel":
            html = (PANEL_HTML.replace("__RANK__", q.get("rank", ["Master IV"])[0]).replace("__RP__", q.get("rp", ["4350"])[0]).replace("__WINS__", q.get("wins", ["7"])[0])
                    .replace("__PRESSPLUS__", "press" if q.get("press", [""])[0] == "plus" else "").replace("__PRESSMINUS__", "press" if q.get("press", [""])[0] == "minus" else ""))
            return self.send(html, "text/html; charset=utf-8")
        self.send("not found", "text/plain", 404)

def shoot(url, out, w, h, scale=4):
    profile = tempfile.mkdtemp(prefix="ryv-shot-")
    try:
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", f"--user-data-dir={profile}",
                        "--default-background-color=00000000", f"--force-device-scale-factor={scale}", f"--window-size={w},{h}", "--virtual-time-budget=4000", f"--screenshot={out}", url],
                       check=True, capture_output=True, timeout=90)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    print("captured", os.path.basename(out))

def main():
    os.makedirs(OUT, exist_ok=True)
    server = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler); server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    states = [
        ("overlay-master-4350-7", dict(rankId="master_iv", rankName="Master IV", rankPoints=4350, winsToday=7, imageUrl="/images/master")),
        ("overlay-master-4350-8", dict(rankId="master_iv", rankName="Master IV", rankPoints=4350, winsToday=8, imageUrl="/images/master")),
        ("overlay-master-4410-8", dict(rankId="master_iv", rankName="Master IV", rankPoints=4410, winsToday=8, imageUrl="/images/master")),
        ("overlay-legend-4610-8", dict(rankId="legend_iv", rankName="Legend IV", rankPoints=4610, winsToday=8, imageUrl="/images/legend")),
        ("overlay-mythic-5240-12", dict(rankId="mythic", rankName="Mythic", rankPoints=5240, winsToday=12, imageUrl="/images/mythic")),
    ]
    for name, state in states:
        STATE.clear(); STATE.update(state)
        shoot(f"http://127.0.0.1:{PORT}/overlay/index.html", os.path.join(OUT, name + ".png"), 362, 92)
    panels = [
        ("panel-master-7", "rank=Master%20IV&rp=4350&wins=7"),
        ("panel-master-8-press", "rank=Master%20IV&rp=4350&wins=8&press=plus"),
        ("panel-legend-8", "rank=Legend%20IV&rp=4610&wins=8"),
    ]
    for name, query in panels:
        shoot(f"http://127.0.0.1:{PORT}/panel?{query}", os.path.join(OUT, name + ".png"), 362, 300)
    server.shutdown()

if __name__ == "__main__":
    main()
