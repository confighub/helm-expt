# Test candidates before promotion

Promotion should move a configuration that passed a stated test. It should not
turn an untested change into a trusted one.

This example asks a small question: **how many NGINX replicas should move to the
next environment?** The destination requires at least two ready replicas. We
test exact configurations with one, two, and three replicas on the same
throwaway Kubernetes cluster.

## The decision

Every candidate must:

1. start successfully;
2. answer all 60 HTTP requests;
3. stay below a deliberately generous local response-time limit; and
4. have at least two ready replicas, because that is the stated destination
   requirement.

The one-replica candidate answers every request, but it fails the destination
requirement. Two and three replicas pass. The selection rule chooses the fewest
replicas among the passing candidates, so the two-replica configuration wins.

This matters because "the application responded" and "this configuration is
right for the destination" are different claims.

## What gets promoted

The test records the complete Kubernetes object set and its hash for each
candidate. The live proof then:

1. uploads the current one-replica YAML as a ConfigHub base;
2. creates staging and production variants;
3. replaces the base with the selected two-replica YAML;
4. previews and runs the staging and production promotions;
5. checks that the base, staging, and production object hashes equal the
   selected candidate hash;
6. publishes the production ConfigHub release as OCI; and
7. checks that Argo CD reconciles that release digest and Kubernetes has two
   ready replicas.

The test result chooses an exact file. ConfigHub keeps that file connected to
the environments and release that use it.

## Run it

The fixture and its recorded result are checked without contacting ConfigHub or
Kubernetes:

```bash
npm run measured-promotion:verify
npm run measured-promotion:self-test
```

The live proof needs an authenticated scratch context for the `helm-catalog`
organization. It creates temporary ConfigHub Spaces and a temporary
`cub cluster up` cluster, then deletes them:

```bash
CUB_CONTEXT=<context> npm run measured-promotion:run
```

Read the [human summary](../../data/measured-promotion-proof/summary.md), the
[machine receipt](../../runs/measured-promotion-proof/receipt.yaml), the
[test plan](../../examples/promotion/nginx-candidate-test/test-plan.yaml), or
the [candidate files](../../examples/promotion/nginx-candidate-test/).

## What changes for a real chart

This NGINX example has no hooks, CRDs, Secrets, migrations, storage, or cloud
setup. A chart that has those parts needs more tests. The Catalog source and
intent record tells the promotion review which prerequisites and lifecycle work
are already known. A missing or untested requirement stays visible; it does not
become a pass because the HTTP check succeeded.

Response times from a laptop are not production capacity evidence. Replace the
example policy with the workload, destination facts, and acceptance limits that
matter for your system. Keep the same rule: record every candidate, select by a
stated policy, and promote the exact configuration that passed.
