#!/usr/bin/env python3
"""Separate benign 'Label: value' reference formatting from the rhetorical
'clause: payoff' construction banned by ConfigHub house style."""
import re, sys, csv
from collections import Counter

VERBS = r"(?:is|are|was|were|has|have|had|does|do|did|can|will|would|should|must|means|makes|gives|shows|takes|needs|works|runs|fails|lets|keeps|stays|comes|goes|holds|carries|matters|happens|becomes|remains|looks|reads|adds|drops|breaks|leaves|turns|sits|lands)"

# rhetorical: subject + finite verb before the colon, full clause after
RHETORICAL = re.compile(
    rf"(?<![\w>])([A-Z][^.:;!?\n]{{8,90}}?\b{VERBS}\b[^.:;!?\n]{{0,60}}):\s+([a-z][^.\n]{{12,}}\.)")
# label: short noun phrase, no verb -- reference formatting, leave alone
LABEL = re.compile(r"^([A-Z][\w \-/]{1,30}):\s")

TRIPLE_RHET = re.compile(
    r"\b(\w{5,}(?:ly|ing|ed|ion|ity|ness|ance|ence)),\s+(\w{5,}(?:ly|ing|ed|ion|ity|ness|ance|ence)),\s+and\s+(\w{5,}(?:ly|ing|ed|ion|ity|ness|ance|ence))\b")

def pages(path):
    cur, buf = None, []
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^===== (.+) =====$", line.strip())
        if m:
            if cur: yield cur, "\n".join(buf)
            cur, buf = m.group(1), []
        else:
            buf.append(line.rstrip("\n"))
    if cur: yield cur, "\n".join(buf)

def main(prose, out):
    rows, cnt = [], Counter()
    for p, t in pages(prose):
        for m in RHETORICAL.finditer(t):
            if LABEL.match(m.group(0)): continue
            rows.append((p, "clause-colon-payoff", " ".join(m.group(0).split())[:150]))
            cnt["clause-colon-payoff"] += 1
        for m in TRIPLE_RHET.finditer(t):
            rows.append((p, "abstract-triple", " ".join(m.group(0).split())[:150]))
            cnt["abstract-triple"] += 1
    with open(out, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["page","category","match"]); w.writerows(rows)
    for k,v in cnt.most_common(): print(f"{v:6d}  {k}")
    print("\nSAMPLES")
    import random; random.seed(3)
    for c in cnt:
        s=[r for r in rows if r[1]==c]
        print(f"\n-- {c} --")
        for r in random.sample(s, min(12,len(s))): print(f"   [{r[0]}] {r[2][:130]}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
