#!/usr/bin/env python3
"""ConfigHub Workshop slop scan.

Inputs : extracted prose blocks (one file, ===== path ===== delimited) + stats json
Outputs: per-page metrics CSV, pattern-hit CSV, over-represented vocabulary CSV
"""
import re, sys, json, csv, math, statistics as st
from collections import Counter, defaultdict
from wordfreq import word_frequency

# ---------------------------------------------------------------- patterns
# Categories mirror the ConfigHub blog house-style ban list where they map,
# else Wikipedia:Signs of AI writing.
PATTERNS = [
    ("negation-reframe", r"\b(?:is|are|was|were|it's|its|that's|this is)\s+not\s+(?:just\s+|merely\s+|only\s+|simply\s+)?[^.,;]{2,40}[,;]?\s*(?:it'?s|but|it is|they are|rather)\b"),
    ("negation-reframe", r"\bnot\s+(?:just|merely|only|simply)\s+[^.;]{2,40}\s*[-\u2014,]\s*(?:it'?s|but)\b"),
    ("not-about-x-its-about-y", r"\bisn'?t about\b[^.]{0,60}\bit'?s about\b"),
    ("colon-then-payoff", r"^[A-Z][^.:!?]{6,60}:\s+\S"),
    ("escalating-triple", r"\b\w+ly\b,\s+\b\w+ly\b,\s+and\s+\b\w+ly\b"),
    ("escalating-triple", r"\b(\w+),\s+(\w+),\s+and\s+(\w+)\b(?=[\s.,;])"),
    ("narrated-significance", r"\b(?:this (?:is|matters|means)\s+(?:why|because|significant|important|the point)|the (?:key|critical|crucial|important) (?:point|insight|takeaway|thing) (?:is|here))\b"),
    ("anointment", r"\b(?:stands as|serves as|represents|is a testament to|marks a|is a cornerstone|plays a (?:vital|key|crucial|critical|pivotal) role)\b"),
    ("signposting", r"\b(?:in this (?:section|guide|page|post|article)|let'?s (?:dive|take a look|explore|walk through)|as we(?:'ll| will)? (?:see|explore|discuss)|first,? let'?s|now that we)\b"),
    ("ritual-summary", r"\b(?:in (?:summary|conclusion|short)|to (?:sum up|recap)|the bottom line(?: is)?|at the end of the day|ultimately,)\b"),
    ("puffery", r"\b(?:seamless(?:ly)?|robust|comprehensive|cutting[- ]edge|powerful|game[- ]changer|revolutionary|state[- ]of[- ]the[- ]art|best[- ]in[- ]class|world[- ]class|unparalleled|unlock(?:s|ing)?|empower(?:s|ing)?|leverag(?:e|es|ing)|streamlin(?:e|es|ed|ing)|elevate(?:s|d)?|supercharge)\b"),
    ("ai-vocabulary", r"\b(?:delve|delves|delving|tapestry|realm|landscape|intricate|multifaceted|nuanced|underscore(?:s|d)?|showcase(?:s|d|ing)?|pivotal|paradigm|holistic|synerg(?:y|ies|istic)|foster(?:s|ing)?|navigate the|myriad|plethora|testament)\b"),
    ("precision-hedge", r"\b(?:it'?s worth noting|it should be noted|it'?s important to (?:note|remember|understand)|arguably|in many ways|to some extent|generally speaking|that said,)\b"),
    ("anthropomorphised-abstraction", r"\b(?:config(?:uration)?|the system|the platform|the pipeline|the chart|the data)\s+(?:knows|wants|understands|decides|believes|remembers|cares|thinks|feels)\b"),
    ("rule-of-three-list", r"\b\w+,\s+\w+,\s+and\s+\w+\.\s"),
    ("false-range", r"\bfrom\s+[\w\s]{3,25}\s+to\s+[\w\s]{3,25}\b"),
    ("em-dash", r"\u2014"),
    ("boldface-verdict", r"^(?:Result|Verdict|Takeaway|Key point|Bottom line|Note|Important|Why it matters|What this means)\b\s*:"),
]
COMPILED = [(n, re.compile(p, re.I | re.M)) for n, p in PATTERNS]

SENT = re.compile(r"(?<=[.!?])\s+")
WORD = re.compile(r"[A-Za-z][A-Za-z'\-]*")

# domain vocabulary that must never be flagged as excess
DOMAIN = set("""confighub helm kubernetes k8s yaml oci sveltos flux argo kustomize
chart charts values manifest manifests cluster clusters namespace namespaces crd crds
digest digests render rendered rendering apply applied unit units variant variants
upstream downstream fleet drift preset presets catalog receipt receipts provenance
config configuration configs repo repos git gitops sha registry image images pod pods
deployment deployments schema schemas cli api json toml ini env kubectl cub""".split())


def split_pages(path):
    pages = {}
    cur, buf = None, []
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^===== (.+) =====$", line.strip())
        if m:
            if cur:
                pages[cur] = "\n".join(buf)
            cur, buf = m.group(1), []
        else:
            buf.append(line.rstrip("\n"))
    if cur:
        pages[cur] = "\n".join(buf)
    return pages


def page_metrics(text, stats):
    words = WORD.findall(text)
    n = len(words) or 1
    sents = [s for s in SENT.split(text.replace("\n", " ")) if len(s.split()) > 2]
    lens = [len(s.split()) for s in sents]
    per1k = lambda x: round(1000.0 * x / n, 1)
    return dict(
        words=n,
        headings_per_1k=per1k(stats["h"]),
        list_items_per_1k=per1k(stats["li"]),
        paragraphs_per_1k=per1k(stats["p"]),
        bullet_to_para=round(stats["li"] / max(stats["p"], 1), 2),
        bold_per_1k=per1k(stats["strong"]),
        tables_per_1k=per1k(stats["table"]),
        emoji=stats["emoji"],
        emdash_per_1k=per1k(text.count("\u2014")),
        mean_sentence=round(st.mean(lens), 1) if lens else 0,
        sd_sentence=round(st.pstdev(lens), 1) if len(lens) > 1 else 0,
        burstiness=round(st.pstdev(lens) / st.mean(lens), 2) if lens and st.mean(lens) else 0,
    )


def main(prose, statsf, prefix):
    pages = split_pages(prose)
    stats = {s["path"]: s for s in json.load(open(statsf))}

    # ---- per-page metrics
    rows = []
    for p, t in pages.items():
        if p not in stats:
            continue
        m = page_metrics(t, stats[p])
        m["page"] = p
        rows.append(m)
    rows.sort(key=lambda r: -r["words"])
    cols = ["page", "words", "headings_per_1k", "list_items_per_1k", "paragraphs_per_1k",
            "bullet_to_para", "bold_per_1k", "tables_per_1k", "emoji", "emdash_per_1k",
            "mean_sentence", "sd_sentence", "burstiness"]
    with open(f"{prefix}_metrics.csv", "w", newline="") as f:
        w = csv.DictWriter(f, cols); w.writeheader(); w.writerows(rows)

    # ---- pattern hits
    hits = []
    cat_tot = Counter()
    for p, t in pages.items():
        for name, rx in COMPILED:
            for m in rx.finditer(t):
                frag = " ".join(m.group(0).split())[:110]
                hits.append(dict(page=p, category=name, match=frag))
                cat_tot[name] += 1
    with open(f"{prefix}_hits.csv", "w", newline="") as f:
        w = csv.DictWriter(f, ["page", "category", "match"]); w.writeheader(); w.writerows(hits)

    # ---- unigram over-representation vs wordfreq human baseline
    allw = Counter(w.lower() for w in WORD.findall("\n".join(pages.values())))
    total = sum(allw.values())
    excess = []
    for w, c in allw.items():
        if c < 4 or len(w) < 4 or w in DOMAIN:
            continue
        base = word_frequency(w, "en")
        if base == 0:
            continue
        obs = c / total
        ratio = obs / base
        if ratio > 8:
            excess.append((w, c, round(ratio, 1)))
    excess.sort(key=lambda r: -r[2])
    with open(f"{prefix}_excess_vocab.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["word", "count", "ratio_vs_wordfreq"]); w.writerows(excess)

    # ---- repeated n-grams (boilerplate / template scaffolding)
    def ngrams(toks, k):
        return [" ".join(toks[i:i+k]) for i in range(len(toks) - k + 1)]
    pagesets = defaultdict(set)
    for p, t in pages.items():
        toks = [x.lower() for x in WORD.findall(t)]
        for g in set(ngrams(toks, 5)):
            pagesets[g].add(p)
    boiler = sorted(((g, len(ps)) for g, ps in pagesets.items() if len(ps) > 2),
                    key=lambda r: -r[1])[:400]
    with open(f"{prefix}_boilerplate.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["five_gram", "pages_containing"]); w.writerows(boiler)

    print(f"pages={len(pages)} words={total}")
    print("\nTOP PATTERN CATEGORIES")
    for k, v in cat_tot.most_common():
        print(f"  {v:6d}  {k}")
    print("\nTOP EXCESS VOCAB")
    for w_, c, r in excess[:40]:
        print(f"  {r:9.1f}x  n={c:4d}  {w_}")
    print("\nMOST REPEATED 5-GRAMS")
    for g, c in boiler[:20]:
        print(f"  {c:4d} pages  {g}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
