UX discovery report: Compose a platform and app

Entry: http://127.0.0.1:8768/site/index.html
Guide found: “Compose and review a local workshop stack” (linked from the home page under “Run a complete local Guide: Compose a platform and app”). The home page also exposes direct links for “Recover from a refusal” and “Save and resume”, which land on anchors in the same guide.

Concrete runnable workflow

The guide’s retained example is the Kubara GitOps shop stack, driven by `stacks/kubara-gitops-shop.yaml` in the pinned `cub-workshop` checkout. Setup commands shown are:

    git clone https://github.com/confighub/cub-workshop.git
    cd cub-workshop
    git checkout 56e261a87dc3b060a86474bc796d379dd9bb7f3d
    cub plugin install "$PWD"

Start in a directory that does not already contain `cub-workshop`. Required: Node.js, Git, `cub` on PATH, and GitHub access for setup. Not required: ConfigHub account/credentials, registry access after setup, cluster, Docker, Helm, or cloud access.

Baseline and resume

    mkdir compose-demo
    cd compose-demo
    cub stack sandbox ../stacks/kubara-gitops-shop.yaml --workspace ./platform
    mv platform platform-moved
    cub stack certify ./platform-moved/stack.yaml --json > ./platform-moved/resume.json

Expected exit code is 0 and the baseline reports 184 objects. Preserve `platform/result.json`, `platform/rendered.yaml`, `platform/stack.yaml`, and every file under `platform/components/`; after moving, preserve the complete directory and certify `platform-moved/stack.yaml`. The saved workspace is materialized configuration plus a review receipt; it is not a ConfigHub Space.

Change review

Edit only `platform-moved/components/06-shop-web.yaml`, changing the shop-web Deployment `spec.replicas` from 3 to 2. Keep the original rendered/result files unchanged. Run certification to `changed-result.json`, sandbox render to `changed.yaml`, then `git diff --no-index` the two renders. The first two commands should exit 0; the diff should exit 1 because it found the intended replica difference.

Refusal and recovery

Copy `platform-moved` to `incompatible`. In `incompatible/components/06-shop-web.yaml`, change only the ExternalSecret API version from `external-secrets.io/v1` to `external-secrets.io/v1beta1`. Certify to `incompatible/refusal.json`; expected exit code 1 and `certified: false`. The bundled External Secrets CRD serves v1, so certification refuses the incompatible version and does not produce a changed materialized render.

Recover by copying `incompatible` to `recovered`, restoring only that API version to v1, and certifying to `recovered/recovery.json`; expected exit code 0. Keep the original refusal JSON and workspace alongside recovered. This demonstrates static compatibility recovery; it does not roll back or recover a running application.

Success boundary

Success proves source resolution, static composition/certification, local materialization, exact changed-field diff, refusal evidence, and a resumable moved workspace. It does not prove ConfigHub creation, delivery, readiness, application health, cluster contact, GitOps reconciliation, OCI publication, namespaces, issuer, secret store, target availability, controller health, or application response. Target prerequisite warnings remain unverified.

AI assistant task

The guide offers a copyable task for an assistant in a fresh `compose-ai` directory. It instructs preserving baseline and refusal artifacts, reporting exit codes, changed field, result hashes, refusal reason, and unverified target prerequisites, while explicitly forbidding contact with cluster, ConfigHub, registry, or credentials.

UX observations

The home page has a strong start-from-need entry point and anchor links reduce hunting. The guide is a long, linear article with a right-side “On this page” rail and left section navigation; the sticky/visible rails make sections discoverable on desktop. Code blocks are copy-friendly-looking but the workflow is still manual and requires careful directory/file preservation. The key 184-object expectation and “saved workspace is not a ConfigHub Space” boundary are clearly surfaced. “A task for an AI assistant” is near the end, so a user seeking assistant-led execution must scroll or use the rail.

Useful next action: run the copyable AI task in a fresh local `compose-ai` directory (with normal approvals), or follow the shell workflow and inspect the saved JSON/rendered files before any deployment decision.
