# Adding a human baseline

`scan.py` currently scores vocabulary against `wordfreq` (general English).
For a technical corpus that is the wrong baseline: it ranks `webhooks`,
`cluster-rbac` and `kube-prometheus-stack` as the most over-represented
words in the corpus, which is true and useless.

Point it at docs.confighub.com instead:

1. Get the docs as text. Either clone the mkdocs source repo and use the
   `.md` files, or crawl the built site:

       wget -r -np -k -A html https://docs.confighub.com/
       find docs.confighub.com -name '*.html' | python3 extract.py base.txt base_stats.json

2. Replace the `word_frequency(w, "en")` call in `scan.py` with a lookup
   against the baseline counts:

       base = base_counts[w] / base_total

3. Re-run. Anything still over-represented is register, not domain, because
   the baseline now contains the same vocabulary.

Same applies to `structure.py`: run it over the baseline first and use the
resulting mean sentence length, burstiness, simple-sentence share and
enumeration rate as target bands rather than the arbitrary ones in this repo.

NOTE: as of 2026-08-27, sub-pages of docs.confighub.com returned HTTP 404 to
an automated fetcher even though the site index links to them. Root
(`https://docs.confighub.com/`) served fine. Worth checking before crawling.
