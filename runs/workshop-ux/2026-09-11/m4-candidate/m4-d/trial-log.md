# M4-D trial log

Guide discovered from `http://127.0.0.1:8768/site/index.html`, linked as `./d/docs/user/workshop-match-guide.html`; saved copy: `./guide.html`.

Setup was supplied and excluded (`./setup.json`, `setupExcluded: true`). Plugin checkout used: `./plugin` (pinned SHA `56e261a87dc3b060a86474bc796d379dd9bb7f3d`). Every `cub` invocation used `CUB_CONFIG=./cli/config.yaml`.

Inputs:

- `./trial/inputs/model.yaml`
- `./trial/inputs/nodes.yaml`
- `./trial/inputs/insufficient-gpu-nodes.yaml`
- `./trial/inputs/missing-gpu-nodes.yaml`

Commands were run separately through installed `cub app match`, with JSON receipts and stdout/stderr retained:

- Candidate receipt `./trial/results/candidate.json`, log `./trial/logs/candidate.log`, exit `./trial/exitcodes/candidate.exit` = 0.
- Insufficient GPU receipt `./trial/results/insufficient-gpu.json`, log `./trial/logs/insufficient-gpu.log`, exit `./trial/exitcodes/insufficient-gpu.exit` = 1.
- Missing GPU fact receipt `./trial/results/missing-gpu.json`, log `./trial/logs/missing-gpu.log`, exit `./trial/exitcodes/missing-gpu.exit` = 3.

Friction: an initial macOS `sed -i` attempt failed to edit the copied files; inspection caught unchanged inputs, then the two files were corrected and rerun with fresh output names.
