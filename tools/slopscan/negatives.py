#!/usr/bin/env python3
"""Three tells the vocabulary scanners miss, all present in the sample passage:
  1. negative specification  - defining a thing by what it is not
  2. heading stacking        - headings with no prose between them
  3. upsell tail             - the closing ConfigHub pitch
"""
import re, sys, csv
from collections import Counter

SENT = re.compile(r"(?<=[.!?])\s+")
NEG = re.compile(r"\b(?:not|no|never|neither|nor|without|none|cannot|can't|don't|doesn't|won't|isn't|aren't|nothing|unnecessary)\b", re.I)
NEITHER = re.compile(r"\bneither\b[^.]{0,60}\bnor\b", re.I)
AGENTLESS = re.compile(r"\b(?:is|are)\s+(?:not\s+)?(?:required|needed|necessary|supported|permitted|expected)\b", re.I)
YOU_DONT = re.compile(r"\byou (?:do not|don't|will not|won't|cannot|can't|need not)\b", re.I)
UPSELL = re.compile(r"\bConfigHub\b[^.]{0,80}\b(?:becomes useful|is for|when you (?:want|need)|adds|comes in|helps)\b", re.I)

def pages(path):
    cur, buf = None, []
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^===== (.+) =====$", line.strip())
        if m:
            if cur: yield cur, "\n".join(buf)
            cur, buf = m.group(1), []
        else: buf.append(line.rstrip("\n"))
    if cur: yield cur, "\n".join(buf)

def main(prose, label):
    rows = []
    tot = Counter()
    for p, t in pages(prose):
        ss = [s for s in SENT.split(t.replace("\n", " ")) if len(s.split()) > 2]
        if len(ss) < 10: continue
        negs = [1 if NEG.search(s) else 0 for s in ss]
        # longest run of consecutive negative-specification sentences
        run = best = 0
        for n in negs:
            run = run + 1 if n else 0
            best = max(best, run)
        pct_neg = 100 * sum(negs) / len(ss)
        # NOTE: a heading-stack metric was tried here and removed: it matched
        # table cells, not stacked headings. See FINDINGS.md.
        lines = [l.strip() for l in t.split("\n") if l.strip()]
        stack = maxstack = 0
        for l in lines:
            if len(l.split()) <= 9 and not l.rstrip().endswith((".", "?", "!", ":")):
                stack += 1; maxstack = max(maxstack, stack)
            else:
                stack = 0
        r = dict(page=p, sents=len(ss), pct_neg_sents=round(pct_neg),
                 max_neg_run=best,
                 neither_nor=len(NEITHER.findall(t)),
                 agentless_required=len(AGENTLESS.findall(t)),
                 you_dont=len(YOU_DONT.findall(t)),
                 upsell=len(UPSELL.findall(t)),
                 max_heading_stack=maxstack)
        rows.append(r)
        for k in ("neither_nor", "agentless_required", "you_dont", "upsell"):
            tot[k] += r[k]
    rows.sort(key=lambda r: -(r["pct_neg_sents"] + 5 * r["max_neg_run"]))
    with open(f"{label}_negatives.csv", "w", newline="") as f:
        w = csv.DictWriter(f, list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    n = len(rows)
    print(f"=== {label} ({n} pages) ===")
    print(f"corpus totals: neither/nor={tot['neither_nor']}  "
          f"'is/are required'={tot['agentless_required']}  "
          f"'you do not need'={tot['you_dont']}  upsell tails={tot['upsell']}")
    print(f"pages with an upsell sentence: {sum(1 for r in rows if r['upsell'])}/{n}")
    print(f"median negative-sentence share: "
          f"{sorted(r['pct_neg_sents'] for r in rows)[n//2]}%")
    print(f"\n{'page':34s}{'sents':>6}{'%neg':>6}{'run':>5}{'nei/nor':>8}{'req':>5}{'youdont':>8}{'upsell':>7}{'hstack':>7}")
    for r in rows[:14]:
        print(f"{r['page']:34s}{r['sents']:>6}{r['pct_neg_sents']:>6}{r['max_neg_run']:>5}"
              f"{r['neither_nor']:>8}{r['agentless_required']:>5}{r['you_dont']:>8}"
              f"{r['upsell']:>7}{r['max_heading_stack']:>7}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
