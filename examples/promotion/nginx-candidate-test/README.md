# Test candidates, then promote the one that passed

This example answers one practical question: which NGINX configuration should
move to the next environment?

It tests three exact Kubernetes configurations on the same throwaway cluster.
They differ only in the Deployment replica count: one, two, or three. Every
candidate must answer 60 HTTP requests, stay below a deliberately generous
local latency limit, and satisfy the destination requirement of two ready
replicas.

The one-replica candidate can serve traffic, but it does not meet the stated
destination requirement. The two- and three-replica candidates pass. The rule
selects the smallest passing candidate, so two replicas wins.

The live proof then uploads the current one-replica YAML to ConfigHub, replaces
it with the selected two-replica YAML, previews and runs staging and production
promotions, publishes the production release as OCI, and checks that Argo CD and
Kubernetes use that release.

Run the checked fixture locally:

```bash
npm run measured-promotion:verify
```

Run the live proof in an authenticated scratch context for the `helm-catalog`
organization:

```bash
CUB_CONTEXT=<context> npm run measured-promotion:run
```

This is not a performance benchmark. It proves one small decision process. A
chart with hooks, CRDs, Secrets, migrations, storage, or cloud prerequisites
needs tests for those parts before promotion.
