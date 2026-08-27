#!/usr/bin/env python3
"""Structural signature metrics: sentence rhythm, enumeration load,
heading-sequence templating, and rendering defects."""
import re, sys, csv, statistics as st
from collections import Counter, defaultdict

SENT = re.compile(r"(?<=[.!?])\s+")
WORD = re.compile(r"[A-Za-z][A-Za-z'\-]*")
SUBORD = re.compile(r"\b(?:because|although|though|while|whereas|unless|until|since|if|when|after|before|so that|which|who|whose|where|rather than|even though)\b", re.I)
ENUM = re.compile(r"\b(\w[\w\-]*)(?:,\s+(\w[\w\-]*)){2,}\,?\s+(?:and|or)\s+(\w[\w\-]*)")
DEFECT_EMPTY = re.compile(r"\b(?:is|are|the|a|an|with|for|to|of)\s+(?:the\s+)?[:.]\s")


def pages(path):
    cur, buf = None, []
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^===== (.+) =====$", line.strip())
        if m:
            if cur: yield cur, "\n".join(buf)
            cur, buf = m.group(1), []
        else: buf.append(line.rstrip("\n"))
    if cur: yield cur, "\n".join(buf)


def sentences(t):
    return [s for s in SENT.split(t.replace("\n", " ")) if len(s.split()) > 2]


def main(prose, label):
    all_lens, simple, total, enum_sizes, defects = [], 0, 0, [], 0
    rows = []
    first_lines = Counter()
    for p, t in pages(prose):
        ss = sentences(t)
        if not ss: continue
        lens = [len(s.split()) for s in ss]
        n_simple = sum(1 for s in ss if not SUBORD.search(s) and s.count(",") == 0)
        all_lens += lens; simple += n_simple; total += len(ss)
        for m in ENUM.finditer(t):
            enum_sizes.append(m.group(0).count(",") + 1)
        defects += len(DEFECT_EMPTY.findall(t))
        for ln in t.split("\n"):
            if 3 <= len(ln.split()) <= 8: first_lines[ln.strip()] += 1
        rows.append(dict(page=p, sents=len(ss), mean=round(st.mean(lens),1),
                         sd=round(st.pstdev(lens),1) if len(lens)>1 else 0,
                         pct_simple=round(100*n_simple/len(ss)),
                         pct_short=round(100*sum(1 for l in lens if l<=14)/len(lens))))

    print(f"=== {label} ===")
    print(f"sentences        {total}")
    print(f"mean length      {st.mean(all_lens):.1f} words")
    print(f"sd / burstiness  {st.pstdev(all_lens):.1f} / {st.pstdev(all_lens)/st.mean(all_lens):.2f}")
    print(f"<=14 words       {100*sum(1 for l in all_lens if l<=14)/len(all_lens):.0f}%")
    print(f">=25 words       {100*sum(1 for l in all_lens if l>=25)/len(all_lens):.0f}%")
    print(f"simple (no comma, no subordinator)  {100*simple/total:.0f}%")
    print(f"enumerations of 3+ items            {len(enum_sizes)}  "
          f"({1000*len(enum_sizes)/max(total,1):.1f} per 1k sentences)")
    if enum_sizes:
        print(f"  size distribution: {dict(sorted(Counter(enum_sizes).items()))}")
    print(f"empty-code-span rendering defects   {defects}")
    print("\nrepeated short lines (template ritual), top 20:")
    for l, c in first_lines.most_common(20):
        if c > 2: print(f"  {c:5d}  {l[:70]}")
    with open(f"{label}_rhythm.csv","w",newline="") as f:
        w=csv.DictWriter(f,["page","sents","mean","sd","pct_simple","pct_short"])
        w.writeheader(); w.writerows(sorted(rows,key=lambda r:-r["pct_simple"]))
    print()

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
