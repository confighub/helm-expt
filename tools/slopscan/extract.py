#!/usr/bin/env python3
"""Extract prose + structural stats from the Config Workshop site HTML."""
import re, sys, json, os
from html.parser import HTMLParser

DROP = {"script", "style", "pre", "nav", "head", "noscript", "svg"}
INLINE_CODE_TOKEN = "CODE"  # inline <code> kept as a placeholder so sentences stay intact
BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "div",
         "blockquote", "figcaption", "dt", "dd"}

class Prose(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.buf = []
        self.cur = []
        self.stats = dict(h=0, li=0, p=0, strong=0, code_inline=0, table=0,
                          hr=0, emoji=0)
        self.tagstack = []

    def handle_starttag(self, tag, attrs):
        if tag in DROP:
            self.depth += 1
        if tag == "code":
            self.stats["code_inline"] += 1
            if self.depth == 0:
                self.cur.append(" " + INLINE_CODE_TOKEN + " ")
                self.depth += 1
        if tag in ("strong", "b"):
            self.stats["strong"] += 1
        if re.fullmatch(r"h[1-6]", tag):
            self.stats["h"] += 1
        if tag == "li":
            self.stats["li"] += 1
        if tag == "p":
            self.stats["p"] += 1
        if tag == "table":
            self.stats["table"] += 1
        if tag == "hr":
            self.stats["hr"] += 1
        if tag in BLOCK:
            self.flush()

    def handle_endtag(self, tag):
        if (tag in DROP or tag == "code") and self.depth:
            self.depth -= 1
        if tag in BLOCK:
            self.flush()

    def handle_data(self, data):
        if self.depth == 0:
            self.cur.append(data)

    def flush(self):
        t = " ".join("".join(self.cur).split())
        if t:
            self.buf.append(t)
        self.cur = []

    def close(self):
        self.flush()
        super().close()

EMOJI = re.compile("[\U0001F000-\U0001FAFF\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF]")

def extract(path):
    raw = open(path, encoding="utf-8", errors="replace").read()
    p = Prose()
    try:
        p.feed(raw)
        p.close()
    except Exception:
        pass
    lines = p.buf
    text = "\n".join(lines)
    st = p.stats
    st["emoji"] = len(EMOJI.findall(text))
    st["emdash"] = raw.count("\u2014") + text.count("--")
    st["words"] = len(re.findall(r"[A-Za-z']+", text))
    st["path"] = os.path.relpath(path, "/home/claude/helm-expt/site")
    return text, st

if __name__ == "__main__":
    out_txt, out_stats = sys.argv[1], sys.argv[2]
    paths = [l.strip() for l in sys.stdin if l.strip()]
    stats = []
    with open(out_txt, "w") as f:
        for pth in paths:
            t, s = extract(pth)
            stats.append(s)
            f.write(f"\n===== {s['path']} =====\n{t}\n")
    json.dump(stats, open(out_stats, "w"), indent=1)
    print(f"{len(stats)} pages, {sum(s['words'] for s in stats)} words")
