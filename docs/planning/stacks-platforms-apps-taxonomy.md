# Stacks, platforms, and apps: the settled taxonomy

This note settles what a stack is, what a platform is, and what an app is, and
how a user moves between them. It is the model the Stacks page and the Apps page
are rebuilt from. The decisions here were made with the owner on 2026-09-04.

The problem it fixes: the Stacks page today treats fourteen stacks as one flat
list, when they range from a whole cloud-to-workload platform down to three
services on a cluster you already run. A reader cannot tell what a stack is for,
where one comes from, or how it becomes something running. This note gives the
taxonomy to teach that.

## The nouns

- **Component.** One chart or one app, flattened to an OCI image of its exact
  objects, with its routes and lifecycle work kept alongside. The atom. In
  ConfigHub it is a base variant.
- **Stack.** A manifest that names components and how they compose. `cub stack
  certify` judges it. Nothing runs. A stack is the thing you *get* and *check*.
- **Platform.** A stack once it is running under governance with apps on it. An
  outcome, not a separate noun. There is no platform verb.
- **App.** A workload you bring. It declares what it needs from the platform
  under it. The plugin checks it and uploads it; ConfigHub operates it.

## Altitude: what a stack covers, and the planes that say so

A stack spans a huge range. `eks-inference` provisions a cloud network, an EKS
cluster, node autoscaling, a GPU runtime, and the inference workload — from an
empty account to a served model. `kubara-platform` is three in-cluster services
(cert-manager, Traefik, metrics-server) that assume a cluster already exists.
Both are stacks, same manifest and same certify, at completely different
altitudes.

The **plane** on each component is how a manifest declares its altitude:

- **hub** — the control and profile layer. Held in ConfigHub, never applied to a
  cluster. `eks-inference` has one (its platform profile); a Kubara platform
  does not.
- **mgmt** — infrastructure and platform controllers. For `eks-inference` this
  is the cloud, the cluster, and the AWS controllers; for a Kubara platform it
  is just the in-cluster services.
- **workload** — apps and runtime. For `eks-inference`, the GPU runtime and the
  inference app; for a Kubara platform, your app.

So a full-stack platform uses all three planes because it owns its own
infrastructure; an in-cluster platform mostly uses mgmt plus a workload. The
Stacks page should sort the shipped stacks by altitude, not list them flat.

## Getting a stack: a menu of four

A stack comes to be in one of four ways. Present them as one clear menu, four
distinct doors.

1. **Pick a shipped one.** eks-inference, kubara-platform, data-services, and
   the rest. A catalog of stacks.
2. **From your Kubara platform.** `cub stack from-kubara` turns a real generated
   platform's own output into a certified stack, rendered with Kubara's own
   values. See the two open Kubara builds: the plugin becoming a full
   replacement for confighub-kubara, and an option to swap in the catalog's
   certified images where versions match.
3. **Compose one by hand.** Author a manifest from catalog parts.
4. **Let an assistant compose one.** From the catalog, judged by the same
   certify. The recorded composition proof is the evidence.

## Creating a stack: the manifest, and the certify loop

Authoring a stack is writing the manifest. Each component is **either** a
`bundle:` (a catalog image by digest) **or** an `authored:` / `render:` (your
own file of rendered objects). `plane` is its altitude; `order` sequences it
within a plane, so CRDs land before the resources that use them.

There is no continuous validation. It is a loop: edit the YAML, run `cub stack
certify <file>`, read what it names wrong — a resource conflict, CRDs out of
order, an app need the stack does not meet — fix it, run again. Certify is the
contract you build against.

## Adapting: two places, no new verb

Adaptation is not a plugin verb. It happens in two places, and the second is
what ConfigHub is for.

- **By hand, before upload.** When certify refuses, adapt either side. Change
  the app (its ingress class, a secret it pulls) or grow the platform (add the
  service the app needs). Re-run certify until it passes. The app and the
  platform negotiate through certify. The platform is shaped by its apps.
- **In ConfigHub, after upload.** Once the stack is uploaded as base variants,
  a per-environment, per-region, or per-customer difference is a derived
  variant, and a promotion moves a reviewed change between those variants.
  Uploading and making variants already is "adapt"; no `cub stack adapt` verb is
  needed.

## Apps: bring, check, place — then operate in ConfigHub

An app is a workload you bring. The plugin does two small things with it:

- `cub app check` — read the app's own objects and report what it needs from the
  platform under it (an ingress controller, cert-manager, an operator).
- `cub app upload` — put it into ConfigHub, or place it in a stack next to the
  platform parts it needs.

Everything a user actually wants to do with an app — deploy it, release it,
promote it across environments, roll it back, operate it — happens **inside
ConfigHub**, with the same verbs as any platform component. So an app is
first-class exactly where it matters, in operations, and it does not need
plugin-side "origins" the way a stack does. The plugin checks and places apps;
ConfigHub operates them.

## Platform: the outcome

A platform is what a stack becomes when it runs under governance with apps on
it. It is the result of uploading a certified stack, placing it on clusters, and
governing it in ConfigHub. It is not a separate noun and has no verbs of its
own. "Build a platform" means: get a stack, certify it, upload it, place it, run
apps on it.

## The one model, in order

A stack is the thing you get (four ways) and certify. You adapt it by hand until
it passes, then upload it. In ConfigHub it becomes a platform, and apps deploy,
promote, and operate on it there. The Stacks page should teach exactly that
order, and sort the shipped stacks by altitude so a reader sees the range.

## What this means for the site

- **Stacks page.** Rebuild around: getting a stack (the menu of four), the
  manifest and the certify loop, altitude and planes (shipped stacks sorted by
  level, not flat), adapting by hand, then becoming a platform. Add
  `from-kubara`, which is absent today.
- **Apps page.** Keep it as the app lifecycle: bring, check against a platform,
  place in a stack, then operate in ConfigHub. Make clear that deploy and
  promote are ConfigHub operations, not plugin verbs.
- **Operate page.** Already carries the ConfigHub verbs. The adapt-in-ConfigHub
  layer (variants, promotion) lives here and should be linked from the Stacks
  page's adapt section.

## Still open, tracked elsewhere

- Full catalog OCI coverage. The corrected model: every catalog entry is
  already OCI. Each chart version has one installer package (an OCI image) that
  serves all its base variants render-late; base variants that are safe to
  flatten also get a pre-flattened certified OCI bundle (render-early). The goal
  (owner, 2026-09-04) is as many flattened bundles as possible: generate one for
  every safe-to-flatten variant; the unsafe ones stay render-late through their
  installer package, which is still OCI. 139 installer packages cover all 245
  variants; 85 flattened bundles published so far.
- cub-workshop #5: `from-kubara` absorbs the compile-and-journal so the plugin
  is a full replacement for confighub-kubara.
- cub-workshop #6: `from-kubara --use-catalog` swaps Kubara's charts for the
  catalog's certified images where versions match.
