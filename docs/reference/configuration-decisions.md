# Configuration decisions

A configuration check can report several findings. Before a configuration is
kept or promoted, someone needs to decide what happens to each one.

A `ConfigurationDecision` records that answer for one exact object set:

- `accepted-fix`: the accepted candidate contains a named correction;
- `approved-exception`: the finding remains for a limited scope and until a
  stated review date;
- `rejected`: the candidate must not continue.

The record links each decision to the changed fields and evidence. An exception
must name where it applies, where it does not apply, its conditions, and the
date when it must be reviewed again. A changed object digest or destination
requires a new decision.

## Keep different checks separate

Local checks help before signup and remain advisory. ConfigHub validates a
stored revision and can use managed controls to block delivery. Destination
tests, delivery receipts, and live observations answer later questions.

Approving a decision record does not hide a local finding, turn a local result
into a ConfigHub control, or approve a production workload. The record keeps
these authorities separate so a reader can see exactly what was checked.

The public schema is
[`configuration-decision.schema.json`](../../schemas/configuration-decision.schema.json).
The first complete example follows AI-written NGINX values through six accepted
fixes, one scoped exception, ConfigHub retention, development-to-staging
promotion, and two Argo CD test deployments. Read the
[worked decision chain](../../data/config-review-decision-chain/summary.md).
