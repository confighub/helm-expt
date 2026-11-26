EXPERIMENTAL

# Plan: turning the weekly catalog refresh on

The weekly refresh lane runs every Monday at 06:00 UTC. The maintainer turned
the schedule on on 26 November 2026, before the preconditions below were met:
a catalog that falls behind upstream with nobody told costs more than a weekly
pull request that lists what moved. This page records why it was off, the
preconditions that are still worth meeting, and the rules the lane obeys.

## Why it was off

The lane was merged in #1341 with its derived-view fan-out incomplete. Its
refresh step rewrote `data/latest-top20-refresh/review.csv` without rewriting
three committed views that copy `latest_version` straight out of it, and two of
those three have a `--verify` lane in the main verify chain. The pull request it
opened every Monday would therefore have carried a change that disagreed with
itself, and merging it would have turned `npm run verify` red on main.

That fan-out is now fixed. The schedule stays off anyway, because the two
preconditions below are not met yet, and because a lane that opens pull requests
unattended should start from a catalog that is already current rather than one
it has to chase.

## The retention rule, which is not negotiable

**Published versions are never deleted.** A refresh adds information; it never
removes it. When upstream publishes a newer version the catalog gains a row, and
the older row keeps its recipe, its package, its receipts, and its page. A user
who pinned an older version keeps everything that made that version usable.

This rule already has machinery behind it, and the refresh lane must stay inside
it:

- The Kubara release acceptance pins every file the release recorded in
  `data/kubara-catalog-1.1-full-coverage/release-scope-manifest.json` and fails
  when one is removed or altered. Later lanes may add files; nothing may take
  them away.
- The consumer contract in `catalog-consumer-contract-brief.md` codifies
  never-delete-published-versions as an external promise, not only an internal
  habit.
- The refresh lane's own path guard refuses a diff that reaches outside its
  surface, so it cannot quietly touch a retained root.

A correction is the one case where committed bytes change, and it is a repair
rather than a deletion: when something recorded is wrong, it is fixed in place
and the reason is written down. The version stays.

## Preconditions before the schedule returns

### 1. The catalog is current

The committed refresh view records **7 charts with an update available** out of
20 tracked. A local detection run during #1341 found **14**. Turning on a lane
whose first act is to open a pull request about work nobody has done yet buries
the signal in noise.

The catalog should be brought current by the deliberate path first: refresh the
detection, write the target-scoped replacement decisions, regenerate the
candidate proofs on a known Helm build, and promote additively. Then a weekly
lane has a small, meaningful diff to report rather than a backlog.

### 2. Every npm lane has a role, and none is hidden

`package.json` holds **840 scripts**. The main `verify` chain runs **299** of
them. **72 lanes are named `*:verify` or `verify:*` and are not in that chain**,
which means they look like gates and are not.

That gap is not theoretical. Three of today's nine audit findings were stale
generated data, and two of the three sat in exactly this gap: `app-readiness`
and `preview-readiness` are outside the chain, so nothing told anyone their
reports had drifted from a catalog that grew from 229 to 241 rendered subjects.

Before CI starts enforcing anything on a schedule, each of those 72 lanes needs
a recorded answer to three questions: what it proves, why it is outside the
chain, and what it costs to run. `tests/npm-script-catalog.csv` already carries
`category`, `mode`, `writes_files`, `needs_external_state`, `why`, and `how`
columns per script, so the answer has a home; it needs filling in and then
holding. A lane that turns out to be cheap and offline should join the chain. A
lane that is expensive or needs a cluster should say so where a reader can see
it, and its staleness should be somebody's declared job.

## Rules the lane obeys when it does run

These are already implemented and should stay true:

- It never pushes to `main`. It pushes a `bot/catalog-refresh-<date>` branch and
  opens a pull request against main, and a person merges.
- It runs no live lane. No cluster, no ConfigHub server, no registry write, no
  promotion into supported root paths.
- It never runs the full generator fan-out, which once produced a 2,356-file
  diff. A path guard fails the run when the diff reaches outside the refresh
  surface, and the guard runs before the commit.
- It does not regenerate candidate proofs. That step re-renders charts and
  rebuilds installer packages, so its bytes depend on the exact Helm and cub
  builds. It checks the runner's Helm build against the pin the receipts record
  and reports the answer instead.
- It verifies the refreshed views before opening anything.

## Gaps found in the lane, and what was done

These were recorded before the schedule came back. The four below were fixed
when it did.

- **Duplicate weekly pull requests.** Fixed: while a refresh pull request is
  open, a later run replaces its branch and its description instead of opening
  another.
- **The gate did not run on the bot's own pull requests.** Pull requests opened
  with `GITHUB_TOKEN` do not trigger `pull_request` workflows. Fixed: the lane
  dispatches `full-verify.yml` and `site-verify.yml` on the refresh branch, and
  their checks land on the pull request's head commit.
- **A same-day retry could not push.** Fixed by the same change: the branch is
  reset and force-pushed.
- **The path guard parsed `git status --porcelain` with `awk '{print $2}'`.**
  Fixed: it reads `git diff --name-only --no-renames` and the untracked files,
  one path per line, so both sides of a rename and a path with a space are
  checked whole.

## Still worth doing

1. Bring the catalog current, so that the weekly pull request reports a small
   diff rather than a backlog.
2. Fill in the role of every npm lane, and move the cheap offline ones into the
   verify chain.
