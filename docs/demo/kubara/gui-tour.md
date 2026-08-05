# See the Kubara platform in ConfigHub

This is the screenshot and live-GUI companion to the
[six-step adoption tutorial](adoption.md). It shows the Kubara shape
first, then the additional governance and visibility ConfigHub provides.

Do not use a screenshot as current evidence merely because the UI looks
plausible. Capture and publish the screenshot set only after the
[current live release checkpoint](checkpoints.md#current-live-release-checkpoint)
passes. Each image must be tied to the same source commit, organization,
receipt, and capture date.

## Tour order

### 1. Start at the platform contract

Open the Unit labeled `StartHere=true` and the
`hx-platform/platform-contract` record.

Show:

- Kubara version and exact source Git revision;
- the one-hub/three-spoke platform identity;
- the seven selected platform roles;
- links to the Catalog, matrix, wiring evidence, and both delivery lanes; and
- the exact receipt status behind the tour.

Buyer message: **this is the same Kubara platform, with its source and evidence
made navigable.**

Screenshot checkpoint: platform contract header, source identity, and
navigation labels in one frame.

### 2. Browse components before platform instances

Open the ConfigHub component Catalog before showing target-specific Units.

Show:

- a familiar Kubara-selected component;
- its retained older and newer versions;
- deployable variants and configurations as follow-on views;
- exact chart source and OCI digest metadata; and
- the platform instances that selected that component version.

Buyer message: **Kubara still chooses and wires a platform package; ConfigHub
makes each reusable component and every retained version independently
governable.**

Screenshot checkpoint: one component, its version history, and its instance
relationship.

### 3. Show the recognizable delivery shape

Display the faithful and adapted Argo definitions side by side.

Show:

- `Lane=Faithful`: Kubara's hub Argo, AppProject, ApplicationSets, and spoke
  registration remain recognizable;
- `Lane=Adapted`: ConfigHub takes the governance/hub role while each target
  keeps its local Argo reconciler; and
- the four explicit target clusters and environments.

Buyer message: **ConfigHub adds a simpler operating lane without declaring the
Kubara topology wrong or removing the faithful option.**

Screenshot checkpoint: both lane cards plus the four target relationships.

### 4. Follow one application through four clusters

Use hx-web as the short story and Cubbychat as the richer application.

Show:

- development, staging, production A, and production B instances;
- the exact source revision and OCI digest at each target;
- one target-specific departure;
- production approvals bound to exact revisions and data hashes;
- promotion history; and
- an exact rollback on one production target.

Buyer message: **the platform definition and the application release are
separate, but their target placement and history are visible together.**

Screenshot checkpoints:

1. four-cluster application placement;
2. exact production approval;
3. promotion and departure history; and
4. rollback source and result revisions.

### 5. Open the wiring

Start with curated native `NeedsProvides` Links, not the entire extracted graph.

Show relationships such as:

- application Ingress to ingress class;
- application Certificate to ClusterIssuer;
- Grafana Secret to ExternalSecret or SecretStore; and
- component instances to shared platform capabilities.

Then link to the complete generated wiring evidence for engineering review.

Buyer message: **relationships that were implicit in folders and generated
YAML can become queryable platform facts.**

Screenshot checkpoint: a small, legible set of native Links with both ends
visible.

### 6. Finish with the fleet matrix and clean inventory

Open the 36-cell component/application-by-cluster matrix and the exact orphan
audit result.

Show:

- selected, centralized, and disabled placement;
- desired version and observed release digest;
- Argo sync and workload health;
- target departures; and
- zero unexpected ConfigHub objects, dangling Links, Argo residue, or
  unclassified durable workloads.

Buyer message: **Kubara's platform matrix becomes current data, and the demo
organization is proved clean rather than merely looking tidy.**

Screenshot checkpoint: current matrix plus the zero-orphan receipt identity.

## Explain, but do not spend the demo running

- the long preparation and release qualification pipeline;
- package media types and every member of the platform digest index;
- content-addressed reconciliation and compare-and-set safety internals;
- target-fact and secret isolation mechanics;
- the entire extracted wiring graph; and
- a long cold import while the buyer waits.

These details remain available in the
[technical mini-IDP reference](single-platform.md), the
[importer guide](../../../examples/kubara/git-import/README.md), and the
[reconciliation performance analysis](reconciliation-performance.md).

## Screenshot evidence contract

For every published GUI image, retain alongside the image:

- capture date and UTC time;
- exact source commit;
- ConfigHub organization external and internal IDs;
- Space, Unit, Link, or Component identities visible in the frame;
- accepted mini-IDP and orphan receipt hashes;
- whether sensitive values were absent or redacted; and
- a short caption that states exactly what the image proves and does not prove.

The website generator should refuse to present the screenshot set as current
when those identities no longer match the accepted release receipt.

Next: use the [complete technical reference](single-platform.md) to reproduce
the result.
