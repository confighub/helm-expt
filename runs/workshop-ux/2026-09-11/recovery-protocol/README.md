# Separate-copy recovery protocol retest

Two fresh assistant attempts used the written M5 brief on 2026-09-11:

> Starting from the composed workspace, try an ExternalSecret API version the bundled CRD does not serve. Keep the refusal, explain it, and recover in a separate copy without concealing the failed attempt.

The supplied workspace included an earlier rendered baseline and a newer valid
candidate. Setup was supplied and excluded from observation. Both sessions used
cub v0.4.4 and cub-workshop v0.6.21 at
`56e261a87dc3b060a86474bc796d379dd9bb7f3d`, isolated CLI configuration and
separate working directories. The participant model was gpt-5.6-luna with low
reasoning. No timing benchmark was captured.

Trial A opened the public site during deployment of repository revision
`15d0774b388d3e436971005649d98b4010a20304`; its exact served revision was not
established. Trial B started after that deployment was verified. The written
M5 brief and recovery content were unchanged. This is a protocol retest, not
an experiment attributing a result to a changed product interface.

| Trial | Failed source and result | Separate recovery | Independent review |
| --- | --- | --- | --- |
| [A report](a/result.md) | v1beta1 preserved; exit 1, certified false | v1; new result, exit 0, certified true | [Checks](a/reviewer-review.json), [refusal](a/reviewer-refusal.json), [recovery](a/reviewer-recovery.json) |
| [B report](b/result.md) | v1beta1 preserved; exit 1, certified false | v1; new result, exit 0, certified true | [Checks](b/reviewer-review.json), [refusal](b/reviewer-refusal.json), [recovery](b/reviewer-recovery.json) |

The reviewer checked that the supplied workspace was unchanged, the failed
source retained its unsupported API version, and the recovered source matched
the supplied valid candidate. Independent static certification reproduced both
outcomes. Trial B also saved rendered bytes matching its recovery result.
The logs permit creating the valid copy before inducing failure; these results
therefore establish preserved failure plus separately checked recovery, not
verbatim execution of the Guide's copy-failed-then-restore sequence.

The retained earlier baseline render has SHA-256
`e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6`.
The recovered candidate's computed rendered identity is
`d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`.
These identify different revisions. Trial A's report cites the earlier retained
baseline; that citation must not be used as the new recovery identity.

Each directory contains the participant report and log, reviewer outputs, and
`workspace.tar.gz` with the original, failed and recovered workspaces.
`manifest.json` records original and retained member hashes. Absolute trial
paths and home prefixes are normalized to `$TRIAL` and `$HOME`; the archive
retains the participant reports before presentation link adjustments.

The [earlier broader-brief attempt](../mixed-history-followup/README.md) remains
partial: it repaired the failed source in place. Do not pool these two attempts
with it, discard its failure, or infer a population success rate. The explicit
separate-copy requirement matters. No cluster was contacted, nothing was
applied, and no runtime recovery or data-safe rollback is established.
