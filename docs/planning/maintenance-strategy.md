# Maintenance Strategy — Daily Refresh, Perpetual Public Corpus, Private Tier

**UNOFFICIAL/EXPERIMENTAL** — maintenance and data-retention NOTE.

This note records how the catalog is maintained: the basic service level for the
free public data and tests, how public data is retained over time, and where the
free/paid boundary sits.

## 1. Free-tier SLA: a daily refresh

The basic commitment for the free public catalog is a **daily update to all free
public data and tests**.

- **Deterministic surfaces — daily.** Every generated data view, index, and the
  public site is regenerated and verified daily (the `--generate`/`--verify`
  generator family). These are a pure function of committed inputs, so a daily
  regenerate-and-verify is cheap and provable.
- **Tests / verifies — daily.** The scoped verifiers run daily; the aggregate
  `npm run verify` gate runs as the release check.
- **Live / cluster evidence — on a stated cadence, with freshness shown.** Lanes
  that need a real cluster (local-live, GitOps/OCI, live Helm-vs-ConfigHub
  parity, two-cluster) cannot honestly be claimed "fresh daily" by a cheap job.
  They are refreshed on a stated cadence, and every row shows its freshness, so a
  daily *data* refresh never implies daily *live* re-proof.

Freshness is already observable: `data/doc-freshness/`, `generated-at` stamps,
and the "as of commit" markers make the refresh date and staleness legible. The
SLA is therefore enforceable and auditable, not just a promise.

## 2. Perpetual retention: keep all public data and all its changes

We **retain all public data sets and all changes made to them, in perpetuity.**

- **Git history is the ledger.** Every change to every public data set is a
  commit; the full history is preserved and never rewritten. The public corpus
  is append-only over time.
- **Retire, don't delete.** When a *current* view is rationalized away (see
  [corpus-rationalization-plan.md](./corpus-rationalization-plan.md)), its
  history is retained. Rationalization keeps the *live* surface legible; it does
  not erase the past. The two are complementary: a small, legible current set
  plus a complete historical record.
- **Why.** A longitudinal corpus is itself the asset. How charts, quirks,
  dispositions, evidence, and upstream versions change over time supports
  regression detection, "what changed since" intelligence, and trend analysis
  that a single snapshot cannot.

Git history is the guarantee. Dated public snapshots or tags on top of it are an
optional convenience for cheap time-travel, not a substitute.

## 3. Free vs paid boundary

The line is drawn at **what is shown in the free public charts.**

- **Free.** The public catalog: the public charts, their daily-refreshed data
  and tests, and the full retained public history. The free tier stays fully
  honest about what it shows.
- **Sign-up / paid.** Anything **not** shown in the free public charts may be
  available by signing up or paying. This is backed by a **larger private
  corpus, updated daily**, including new lessons, customizations, and patches —
  more charts and versions, deeper lifecycle and quirk work, private catalogs,
  and faster or SLA-backed support.

This complements the broader commercial model in
[verified-install-commercial-model.md](./verified-install-commercial-model.md);
this note is specifically the maintenance, retention, and free/paid-data piece.

## 4. Principles

- The daily SLA is **automated and verifiable**, not manual goodwill.
- Retention is **append-only**: never rewrite public history.
- Tiering is **additive**: the free tier is complete and honest on its own
  scope; the paid tier is "more," never "the free tier with the truth removed."
- Freshness is always **shown**, so daily-data never implies daily-live-proof.

## 5. Open questions

- The automation mechanism for the daily job (scheduled CI / cron) and where it
  runs.
- Where the private corpus lives, and how the free→private split is enforced per
  data family.
- Stated cadence targets for each live lane.
- Whether to add dated public snapshots/tags on top of git history for easy
  time-series access.
