# slopscan

Register audit for the Config Workshop site. Measures the things that actually
fire on this corpus (enumeration load, sentence rhythm, template ritual) rather
than the LLM vocabulary that does not.

    ./run.sh ../helm-expt/site cw

Outputs per layer: `*_metrics.csv` (per-page structure), `*_hits.csv` (loose
pattern pass), `*_refined.csv` (tightened pattern pass), `*_excess_vocab.csv`,
`*_boilerplate.csv`, `*_rhythm.csv`.

- `FINDINGS.md` — the audit result
- `BASELINE.md` — how to swap the wordfreq baseline for docs.confighub.com
- `edit_queue.csv` — authored pages ranked worst-first
- `styles/ConfigHub/` + `.vale.ini` — Vale rules encoding the blog house-style bans

Requires `python3`, `pip install wordfreq`. Vale optional.
