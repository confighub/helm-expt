# Remote Images And Supported Bases

**UNOFFICIAL/EXPERIMENTAL**

Sometimes a catalog base is **watch-grade** not because the configuration is
wrong, but because the container image it references **disappeared from the
upstream registry**. The rendered objects match regular Helm exactly — the parity
is proven — but the workload cannot start because the image tag was removed,
renamed, made private, or rate-limited. This page is what to do about it.

## How to recognise it

A row is in this family when:

- its matrix G/P (or K) cell is `watch`, and
- the residue is `remote-image` (see
  [residue-families](../reference/residue-families.md)), and
- both regular Helm **and** ConfigHub hit the same image failure
  (`ImagePullBackOff` / `ErrImagePull`).

That last point matters: **it is not a ConfigHub defect.** Regular `helm install`
fails the same way, because the image is simply not pullable on your target. The
per-row breakdown — the exact missing image, where it fails (container, init
container, or a hook/lifecycle job), and the recommended fix — is generated in
[remote-image-runtime-workdown](../../data/remote-image-runtime-workdown/summary.md).

## What you can do

In rough order of preference:

1. **Refresh the chart or base** (`refresh-chart-or-base`). The most common cause
   here is a publisher that rotates and deletes pinned tags (for example Bitnami's
   Debian-suffixed tags). Move the base to a chart version whose pinned image still
   exists. This is catalog work, not a config change.
2. **Use a supported image override** (`supported-image-override`). If the chart
   exposes an image value and a working image exists, override it in a supported
   base. This also covers charts that render `image: auto` for sidecar injection
   (e.g. an Istio gateway): give the base a concrete image, or run the injector.
3. **Pin or mirror a digest** (`pin-or-mirror-digest`). If a digest is still
   retained, pin it; or mirror the image into a registry your target can pull,
   with a pull secret if it is private/paid.
4. **Route the lifecycle image** (`route-lifecycle-image`). If the missing image
   lives only in a hook/lifecycle job (and is otherwise pullable), route that
   lifecycle action and supply its image rather than treating it as a workload
   image.
5. **Watch or refuse**. If none of the above applies yet, keep the base
   watch-grade (and re-check whether the publisher restores the image), or refuse
   it for support until they do — honestly, rather than shipping a base that
   cannot start.

## What the catalog will not do

It will not silently swap in a different image and call the base proven. A
`remote-image` row stays `watch` until a **refreshed or overridden image is
proven** on a real target — the fix is recorded, not assumed. And it will not
present a removed-image base as production-supported just because render parity
passed; the running outcome is part of the claim.

See also: [reading-the-matrix](./reading-the-matrix.md) for the cell states, and
[image-digest-workdown](../../data/image-digest-workdown/summary.md) for the
digest-pinning view of the same images.
