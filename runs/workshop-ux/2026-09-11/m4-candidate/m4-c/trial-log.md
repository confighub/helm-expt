# Trial log

- Inputs copied from the pinned checkout's `examples/match/` into `./inputs/`.
- Guide read from `http://127.0.0.1:8768/site/d/docs/user/workshop-match-guide.html` after discovery via `site/index.html`.
- Candidate command output: `./results/candidate.json`; stdout `./candidate.stdout.log`; stderr `./errors/candidate.stderr.log`; exit `./results/candidate.exitcode` = 0.
- Insufficient-GPU command output: `./results/mismatch.json`; stdout `./mismatch2.stdout.log`; stderr `./errors/mismatch2.stderr.log`; exit `./results/mismatch.exitcode` = 1.
- Missing-GPU command output: `./results/unknown.json`; stdout `./unknown-fresh.stdout.log`; stderr `./errors/unknown-fresh.stderr.log`; exit `./results/unknown.exitcode` = 3. Fresh retry receipt: `./results/unknown-fresh.json`.
- No timing claims recorded. All commands used the installed `cub` CLI with `CUB_CONFIG=./cli/config.yaml`.
