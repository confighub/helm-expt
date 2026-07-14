# Website UX Test Runbook

_A UX test (website walkthrough) in the [helm-expt test map](tests/README.md)._

This runbook helps another Codex, Claude, or teammate start the generated
helm-expt website locally and walk the maintainer through a UX review. The review
starts with the top-level pages, then follows guide and doc links one or two
clicks deeper.

Use it when the goal is to test whether the public site is understandable to a
fresh Helm user. Do not use the walkthrough to rewrite the site live. First
record findings, then make a focused follow-up change.

## 1. Sync And Verify

```sh
cd $HOME/code/helm-expt
git fetch origin
git pull --ff-only
npm run site:verify
```

If the site verifier fails, stop and report the failing page. Do not start the
UX walkthrough from stale generated HTML.

## 2. Start A Local Static Server

Prefer port `8766`.

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory $HOME/code/helm-expt/site
```

Open:

```text
http://127.0.0.1:8766/
```

If the port is already in use, pick another port:

```sh
python3 -m http.server 8767 --bind 127.0.0.1 --directory $HOME/code/helm-expt/site
```

## 3. Test From Another Laptop

`127.0.0.1` only works on the machine running the server.

The simplest option is to run the same commands on the other laptop.

If the server should run on this machine and be viewed from another laptop on
the same network, bind to all interfaces:

```sh
python3 -m http.server 8766 --bind 0.0.0.0 --directory $HOME/code/helm-expt/site
```

Find this machine's LAN IP:

```sh
ipconfig getifaddr en0
```

Then open this from the other laptop, replacing the IP:

```text
http://<lan-ip>:8766/
```

If that does not load, check macOS firewall settings, VPN state, and whether
both laptops are on the same network.

## 4. Top-Level UX Walkthrough

Ask the same question at every step:

```text
Would a Helm user know what to do next without understanding the whole proof system?
```

### Step 1: Home

URL:

```text
/
```

Question:

```text
Can a Helm user understand the promise in 30 seconds?
```

Expected message:

```text
Use Helm charts. Ship ConfigHub variants.
```

Look for:

- a clear first action;
- plain explanation of why visible Helm stages matter;
- no requirement to understand every receipt before continuing.

### Step 2: Try Now

URL:

```text
/try.html
```

Question:

```text
Is the first useful command obvious?
```

Expected:

- Redis is the simple path;
- kube-prometheus-stack is the serious chart path;
- commands are copyable;
- the page says what should happen after each command.

### Step 3: Apps

URL:

```text
/journey.html
```

Question:

```text
Does the page explain how chart bases, variants, custom apps, existing apps,
platforms, and stacks become one application model?
```

Look for:

- a clear distinction between chart choice, variant management, app composition,
  and operations;
- a read-only path for existing Argo, Flux, KRM, rendered-manifest, or live
  cluster inputs;
- links to deeper app guides that tell the user what to type and what to expect.

### Step 4: Status Matrix

URL:

```text
/matrix.html
```

Question:

```text
Does the matrix feel like a product/status page rather than a proof dump?
```

Check whether these states are understandable:

- pass;
- watch;
- blocked;
- not yet run;
- not applicable;
- deferred accepted.

Look for:

- F1/F2/F3/F4 rows are understandable;
- chart links and source links are useful;
- the next action column tells a human what to do.

### Step 5: Hard Questions

URL:

```text
/hard-questions.html
```

Question:

```text
Are skeptical Helm-user questions answered plainly?
```

Check these topics:

- hooks;
- CRDs and webhooks;
- Secrets;
- upgrades;
- custom values and overlays;
- false-green GitOps sync;
- target prerequisites;
- free versus managed use;
- what happens when a public chart breaks the model.

### Step 6: Chart Pages

URL:

```text
/charts/index.html
```

Test Redis first, then kube-prometheus-stack.

Questions:

```text
Does each chart page say what to try?
Does it say what is proven?
Does it say where the limits are?
```

Expected:

- Redis teaches the simple happy path;
- kube-prometheus-stack shows serious chart complexity;
- chart pages link back to matrix, evidence, and proof status.

## 5. Deeper Guide Pass

After the top-level walkthrough, test the pages a real user reaches within one
or two clicks from home. Do not stop at a guide link just because the homepage
looks clear.

For each page, ask:

```text
What am I trying to do?
What should I type?
What should I expect to see?
Do I need local files, kind, cub-lk, a bring-your-own cluster, a GitOps controller, or a ConfigHub account?
Is this proved, watch, blocked, planned, or not applicable?
Where do I go next?
```

Minimum depth sample:

| Starting page | Deeper page to test | Why |
| --- | --- | --- |
| Home | `how-it-works.html` | Checks whether the four-move model is actionable. |
| Home | `docs.html` | Checks whether "Guides" are useful and not just a raw doc dump. |
| Get Started | `../docs/user/expected-results-and-clusters.md` | Checks cluster guidance and optional npm proof language. |
| Helm Catalog | Redis chart page | Checks simple chart run path, variants, caveats, and next action. |
| Helm Catalog | kube-prometheus-stack chart page | Checks serious chart quirks, CRDs, lifecycle, and proof boundaries. |
| Apps | `../docs/user/adopting-existing-apps.md` | Checks existing-app discovery/import guidance. |
| Ops | `../docs/user/verify-it-yourself.md` | Checks observation commands and expected result language. |
| Ops | `../docs/user/day2-upgrade-rollback.md` | Checks upgrade and rollback story. |
| FAQ | `known-gaps.html` | Checks whether hard limitations are understandable. |
| Home AI card | `../docs/user/ai-assisted-helm-changes.md` | Checks whether AI claims are concrete and bounded. |

Record whether each deeper page is:

```text
clear enough
clear but missing a command
clear but missing expected output
too much raw proof data
confusing or contradictory
```

## 6. Record Findings

Use this format:

```text
P0: Blocks a fresh user from understanding or trying the site.
P1: Makes the site confusing, overclaims, or hides a key product boundary.
P2: Polish, wording, layout, link, or navigation improvement.
```

For each finding, record:

```text
Page:
Step:
Problem:
What the maintainer expected:
Suggested fix:
```

## 7. If Fixes Are Requested

Do not edit generated HTML by hand.

Edit the generator or source docs:

```text
scripts/generate-public-site.mjs
scripts/generate-master-catalog-matrix.mjs
README.md
docs/user/README.md
docs/user/*.md
```

Then regenerate and verify:

```sh
npm run site:generate
npm run master-matrix
npm run site:verify
npm run master-matrix:verify
npm run docs:verify
git diff --check
```

Commit only focused changes that answer the UX finding.

## 7. Stop The Server

If the server is running in the foreground, press `Ctrl-C`.

If it is running in another shell, find and stop it:

```sh
lsof -nP -iTCP:8766 -sTCP:LISTEN
kill <pid>
```
