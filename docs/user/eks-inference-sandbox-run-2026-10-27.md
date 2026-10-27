# A run of the EKS inference stack check, 2026-10-27

**UNOFFICIAL/EXPERIMENTAL**

This log records one run of `cub stack sandbox eks-inference` on a laptop. The
page [Try an EKS GPU inference platform on your laptop](../../site/eks-inference.html)
prints its output from this log.

This is a dated record of one run. It is not a receipt. The line that starts
with `$` is the command that was run, and the text under it is what it printed.

## Versions and setting

- The client is cub v0.9.0 (commit c333fa66, built 2026-10-23).
- The workshop plugin is 0.6.61, installed with `cub plugin install confighub/cub-workshop@v0.6.61`.
- The run used an empty scratch directory. It needed no ConfigHub account, no AWS account, no cluster and no GPU.
- Before the stack output, the run printed two kinds of line that this log leaves out. One was a warning that a saved ConfigHub sign-in had expired. The command does not use the sign-in, and the result does not depend on it. The others were one note per part saying that a local download cache was incomplete and was being replaced with a fresh pull. Those notes name a temporary directory on the machine.
- The whole run took about 8 seconds, most of it pulling the eight parts.

## The run

```
$ cub stack sandbox eks-inference

Stack: eks-inference  —  The EKS inference platform as a stack: eight digest-pinned certified bundles across three planes. The keystone, spoken in the settled vocabulary.
Resolving 8 components: platform-profile, ack-controllers, aws-network, eks-cluster, karpenter-aws, karpenter, gpu-runtime, inference-workloads

Check
  [PASS] no resource conflicts across components (130 objects)
  [WARN] 2 object(s) carried more than once inside one component with identical content; kubectl apply keeps the last, but cub stack upload refuses the component:
      apiextensions.k8s.io/v1|CustomResourceDefinition||fieldexports.services.k8s.aws  x3  inside  ack-controllers
      apiextensions.k8s.io/v1|CustomResourceDefinition||iamroleselectors.services.k8s.aws  x3  inside  ack-controllers
  [PASS] CRD ordering: 46 CRDs are delivered before the 25 custom resources that need them
  [PASS] served API versions: 25 custom resource(s) match their bundled CRD; target availability is not checked
  [PASS] no admission webhooks need a certificate
  [WARN] namespaces: 4 created, 1 must already exist (kube-system)
  [PASS] schema validation: 129 object(s) valid against the default and ecosystem catalogs (flux-schema/0.16.0); 2 quantities written as a number, which the API server accepts
  => CHECKED

Sandbox render  (free, no infrastructure)
  130 objects total
      platform-profile: 1  [hub: held in ConfigHub, never applied]
      ack-controllers: 72  [mgmt]
      aws-network: 14  [mgmt]
      eks-cluster: 5  [mgmt]
      karpenter-aws: 2  [mgmt]
      karpenter: 23  [workload]
      gpu-runtime: 6  [workload]
      inference-workloads: 7  [workload]

  Rendered, but `cub stack upload` will refuse it: ack-controllers defines an object more than once (the WARN above). Rebuild that component or leave it out of the manifest.
```

## What the run shows

The check passed. The eight parts hold 130 objects, and no two parts claim the
same object. It raised two warnings. The first is that three ACK controller
charts inside one part each carry the same two CRDs. Applying them with kubectl
works, because the copies are identical, but `cub stack upload` refuses that
part until it is rebuilt with one copy. The second is that the stack expects
the `kube-system` namespace to exist already.

The run did not create an EKS cluster, call AWS, or start anything on a GPU.
