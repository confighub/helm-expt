# Mixed-history recovery follow-up

One fresh assistant received the earlier materialized candidate workspace,
including baseline and previous candidate results, plus the pinned installed
Workshop plugin. Public release: `ae083116d235270c459d6e87a72c9c07a287f4d9`;
plugin: `56e261a87dc3b060a86474bc796d379dd9bb7f3d`. Setup was supplied and
excluded. The task asked for a static incompatible-API refusal and safe recovery
while preserving evidence and original work. It did not provide the answer or
the Guide's step sequence. This is one assistant observation, not a cohort rate.

The original platform-moved files were independently compared with the supplied
source and remain byte-identical. The refusal result is certified false and the
fresh recovery result is certified true. The agent ran a new certification after
the refusal; it did not mistake an earlier candidate result for recovery.

However, it repaired the incompatible source in place. The refusal JSON and
exit code survive, but the failed source workspace does not. This does not meet
the Guide's stronger requirement to preserve the incompatible copy alongside
a separate recovered copy. Outcome: fresh-result confusion avoided, failed-source
preservation incomplete. Keep #1897 open; do not call this full recovery acceptance.

The recovered render matches the prior candidate hash, not the original baseline
render. The report recognized the baseline/candidate difference. Neither static
certification nor sandbox rendering proves live recovery, deployment, target
availability, or application health.

Reports are retained without correcting their claims. workspace.tar.gz contains
all trial outputs except the supplied plugin and isolated CLI installation.
manifest.json records original and retained hashes; trial and home paths were
normalized to $TRIAL and $HOME. The original report says failures were retained;
that means result artifacts, not an unchanged failed source copy.
