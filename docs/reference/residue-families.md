# Residue Families — what a non-green row actually means

**UNOFFICIAL/EXPERIMENTAL**

When the master catalog matrix shows a row as `watch` or `blocked` instead of
`pass`, the decision surfaces tag it with a **residue category** — the *kind* of
gap that stopped the row from being green. This page is the plain-English
vocabulary for those categories: what each family means for a Helm user, **who
has to fix it**, the **next action**, and **where the rows live**.

It is reference only. The authoritative per-row classifications are generated
into the decision surfaces — this page names the families behind them.

- For the matrix itself (lanes, the G/P/K shorthands, the cell states), read
  [reading-the-matrix](../user/reading-the-matrix.md).
- For the live per-row decisions, read
  [live-parity-decisions](../../data/live-parity-decisions/summary.md) (G/P-lane)
  and [kind-parity-decisions](../../data/kind-parity-decisions/summary.md) (K-lane).
- To pick the next row to work, read
  [live-parity-rerun-plan](../../data/live-parity-rerun-plan/summary.md).

## How to read a residue, honestly

- A **`watch`** row is *known evidence with a named residue*. The semantic
  Helm-vs-ConfigHub parity already passed — the delivered objects match regular
  Helm — but a runtime, controller-health, image, or operational condition still
  needs review. It is **not a pass and not a failure**.
- A **`blocked`** row did not reach the lane result. Its residue names *why* and
  *who owns the fix*.
- A residue category never turns a `watch` into a `pass` or a `failure`. It
  explains the gap and routes the fix. **Nothing here is automatic or "solved"
  by tagging it** — a family is a decision, not a repair.

## The families

Family names are grouped by theme. The same theme can carry a slightly
different category key (and a different owner) in the G/P-lane vs the K-lane,
because the two lanes prove different things; both keys are listed.

| Family | What it means for a Helm user | Who fixes it | Usable today? | Lane · category key |
| --- | --- | --- | --- | --- |
| **Target prerequisite** | The rendered objects matched regular Helm; a named prerequisite (Namespace, Secret, or CRD) is missing on the target. The prerequisite is missing, not the configuration. | user | Yes, after you stage the prerequisite | G/P · `target-prerequisite` — K · `target-prerequisite-crds` / `-secret` / `-namespace` |
| **Remote image** | Parity passed, but the chart references a container image the target cannot pull (removed/renamed tag, private or paid registry, rate-limited pull). The workload can't start until the image is reachable. | catalog or image publisher | Watch — until the image reference is resolved | G/P · `remote-image` |
| **Render input** | Required Helm input values are missing, so the base renders incomplete or invalid objects. Regular Helm and ConfigHub block on the same validation. | catalog (G/P: needs a better base) · user (K: supply values) | No on the default base — until inputs are supplied or a better base is chosen | G/P · `render-input` — K · `render-input` |
| **Capability profile** | Parity passed, but the base rendered for a Kubernetes capability the target does not serve (e.g. an APIService version a newer cluster dropped). A render-profile / base-selection issue, not a semantic diff. | catalog | Depends — use or promote the base rendered for the target's API set | G/P · `capability-profile` — K · `capability-profile-diff` |
| **Hook / lifecycle** | The chart relies on a Helm hook or controller-populated lifecycle behavior (e.g. a certgen Job) that config-only delivery does not run. Needs a lifecycle route or staged equivalent. | catalog | No — until a lifecycle route is decided | K · `hook-lifecycle` (see [lifecycle-route-actions](../../data/lifecycle-route-actions/summary.md)) |
| **Platform target fit** | Parity passed, but the target does not provide the platform shape required by the base (for example AWS/EKS metadata, provider identity, schedulable node count, or load-balancer behavior). | user or catalog | Watch — use a target that satisfies the base, or create a target-scoped base | G/P · `target-fit` |
| **Target runtime** | The rendered config matched regular Helm, but the workload did not reach the expected runtime state on the target. Runtime residue to review. | needs runtime review | Watch — config correct, runtime unconfirmed | G/P · `target-runtime` — K · `target-runtime` |
| **GitOps controller health** | Synced through ConfigHub OCI/Argo and converged, parity passed — but Argo's aggregate health reads Progressing, or a resource reads OutOfSync while Healthy. | needs GitOps controller-health review | Watch — synced and converged; aggregate health needs explanation | G/P · `gitops-runtime` |
| **Operate policy** | Parity passed, but an operational readiness step (for example init/unseal) is required before the workload is fully ready. | needs operate review | Watch — needs an operational step | G/P · `operate-policy` |
| **Model / semantic gap** | The ConfigHub delivery did not match the live Helm result (a semantic/model difference, a missing target fact, or a render difference). Not a user action. | catalog | No — needs catalog/model work | G/P · `semantic-model-gap` — K · `model-gap-render` / `model-gap-target-fact` |

Live counts per family change as the live lane runs; read the decision surfaces
above for the current rows — this page deliberately does not hard-code numbers.

## Remote image, in detail (worked example: Contour)

`remote-image` is the family a Helm user is most likely to hit first, because it
looks like a chart failure but is really an image-availability problem on *your*
target.

Worked example — **`bitnami/contour@21.1.4`** (default and no-crds):

- Regular Helm itself blocks: the pre-install certgen Job can't start because the
  pinned `docker.io/bitnami/contour` image is not pullable (`ImagePullBackOff`).
- ConfigHub direct apply and ConfigHub OCI/Argo **preserve semantic parity** —
  the delivered objects match regular Helm — but the row stays `watch` because
  the hook-generated TLS Secrets (`contourcert`, `envoycert`) are absent and the
  pods do not become ready. (That second half is a *hook/lifecycle* residue
  layered on top — see the hook/lifecycle family.)

So the row is honest: parity is proven, but the chart can't run on a target that
can't pull its image. The same family covers **Apache**, **OpenSearch**, and the
**Istio gateway** rows.

What a user or the catalog can do — **none of these is applied automatically**:

- **Catalog refresh** — move the base to a currently-published image tag.
- **Digest pin** — pin a digest that is still retained in the registry.
- **Registry mirror / pull secret** — point the target at a mirror, or supply an
  `imagePullSecret` for a private/paid registry.
- **Image override** — override the image reference to one your target can pull.
- **Registry policy** — accept a private/paid-registry requirement as a scoped
  support boundary.

This is a **decision family, not a fix**. Tagging a row `remote-image` does not
make the image pullable; it tells you the parity question is already answered and
the open question is image retention/access on your target.

Distinguish it from neighbours: `target-runtime` means the image pulled but the
workload misbehaved; `render-input` means values were missing before any image
mattered; `hook/lifecycle` means a hook action (not an image) is the gap.

## Platform target fit, in detail (worked example: AWS EBS CSI)

Some charts need a specific **platform identity** rather than a generic
Kubernetes target. The committed AWS EBS CSI receipt is the concrete example:

- Regular Helm, ConfigHub direct apply, and ConfigHub OCI/Argo all preserve
  semantic object parity.
- The workloads crash-loop on vanilla kind because the driver cannot read AWS
  instance metadata (IMDS), cannot find an AWS instance id in node `providerID`,
  and has no AWS region.
- Argo pulls and applies the ConfigHub OCI payload, then reports the application
  as `Synced / Degraded` because the workload cannot run on that target.

That is **platform target fit**, not a render defect. A useful base needs an
AWS/EKS-like target profile, or an explicit target-scoped base/refusal for
non-AWS clusters. The chart-local support artifact is
[target-topology.yaml](../../recipes/aws-ebs-csi-driver/aws-ebs-csi-driver/2.60.1/target-topology.yaml).

## From a non-green row to a support decision

A residue category answers *why a row isn't green* and *who fixes it*. It does
**not** by itself decide whether a chart/base is production-supported. To move a
chart/base from `watch`/`todo` toward **supported**, **target-scoped support**,
**rejected**, or **superseded**, the residue has to be resolved or explicitly
accepted for a named scope, backed by fresh evidence. That decision and its
required evidence are recorded separately:

- [production-support-decisions](../user/production-support-decisions.md) — the
  product states and how to work the queue.
- [production support decision contract](../../data/production-disposition/support-decision-contract.md)
  — the required decision fields (supported base, target scope, delivery path,
  scan/image/lifecycle decisions, live evidence, support boundary).
- [capability-profile-catalog](./capability-profile-catalog.md) — for the
  capability-profile family, the named profiles a base can render against.

## Boundaries

- Reference only. The per-row classifications are generated into the decision
  surfaces; this page names the vocabulary behind them and does not assert any
  row's state itself.
- A residue family is a routed decision, never an automatic repair, and never a
  reclassification of a `watch` as a `pass`.
