# promote-silent-skip-proof — read-only receipts

Captured 2026-07-07 (~11:05–11:15 UTC) against org `helm-catalog`
(`bd8...107`), backing the "Exhibit finding: promote and same-map departures
(2026-07-03)" in [data/helm-org/summary.md](../../data/helm-org/summary.md),
cited in confighubai/confighub#4698. Until this capture the finding was backed
only by live org state plus narrated prose; these files are the committed
command output. Everything here is read-only (`cub revision list`,
`cub revision data`, `cub unit get`, `cub unit data`) — no unit was mutated.

Each capture file's **first line is the exact command** that produced the rest
of the file. See [receipt.yaml](./receipt.yaml) for the claim/evidence/drift
summary in the repo's receipt shape.

## The finding, in the captured files

The vault demo exhibit is one base + three variants of
`statefulset-vault-vault`:

| Unit (space) | Departure | Revision history | Upstream pointer |
|---|---|---|---|
| `hashicorp-vault-demo-base` | — | revs 3/4/5 = three consecutive `set-annotation` releases (`telemetry`, `release-track`, `probe`); rev 6 removes `probe` | (base) |
| `hashicorp-vault-env-staging` | `spec.replicas: 2` (field-level) | revs 4/5 = **UpgradeUnit** pulls delivering the keys, replicas 2 intact | 8 |
| `hashicorp-vault-env-prod` | `spec.replicas: 3` (field-level) | revs 4/5 = **UpgradeUnit** pulls delivering the keys, replicas 3 intact | 6 |
| `hashicorp-vault-env-dev` | `cost.confighub.com/center` annotation (**same map** the releases write to) | **zero UpgradeUnit revisions** — every rev is CloneUnit/Invoke; revs 5/6 are by-hand reconciles | **5** |

Dev is the finding: `cub variant promote` ran against it across the three base
releases, reported success each time, advanced its `UpstreamRevisionNum` to
the then-base-head (5, see `unit-get-dev.json`) — and created no revision and
delivered none of the keys (`revision-list-dev.txt`,
`revision-data-dev-rev4.yaml`). The environment reads as caught up while
missing the releases on that map. Staging and prod are the control: same
releases, field-level departures, delivered normally as UpgradeUnit revisions
with departures intact.

`extract-annotations-replicas.txt` is a locally-derived per-revision table of
`metadata.annotations` (`*.confighub.com/*` keys) + `spec.replicas` across all
captured revisions — the present/absent story at a glance.

## Files

- `revision-list-{base,dev,staging,prod}.txt` — human-readable revision
  history (SOURCE column shows Invoke vs UpgradeUnit); `.json` twins carry
  `--select "*" -o json` for machine checks.
- `unit-get-{base,dev,staging,prod}.json` — full Unit entities;
  `HeadRevisionNum` / `UpstreamRevisionNum` / `UpstreamUnitID`
  (dev/staging/prod all point at the base's UnitID `c5c81eee-...`).
- `revision-data-<env>-rev<N>.yaml` — the Unit data at each key revision:
  base 2–6 (keys accreting, then `probe` removed), dev 4–6 (departure only,
  then the two hand reconciles), staging/prod 3–5 (departure baseline, then
  the two UpgradeUnit deliveries).
- `unit-data-dev-head.yaml` — dev's current head data.
- `extract-annotations-replicas.txt` — derived summary table (not command
  output; script noted in the file header).

## Drift since the 2026-07-03 finding

State observed 2026-07-07 still reproduces every element of the finding.
Additions since: base revs 7/8 and staging revs 6/7 are the later
confighubai/confighub#4697 reproduction (set-env steps, staging rev 7 a
further UpgradeUnit → staging pointer now 8). Prod's pointer reads 6 because
its rev-5 pull ran ~1s after base rev 6 removed the `probe` key, so the rev-5
pulls delivered `telemetry`+`release-track` only — and dev never received
`probe` at all while its pointer read 5.

Capture note: one query (prod rev 5 data) hit a transient
`net/http: TLS handshake timeout` and was re-run cleanly; the committed file
is the clean re-run.
