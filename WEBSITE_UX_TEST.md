# Website UX Test Runbook

This runbook helps another Codex, Claude, or teammate start the generated
helm-expt website locally and walk Alexis through a six-step UX review.

Use it when the goal is to test whether the public site is understandable to a
fresh Helm user. Do not use the walkthrough to rewrite the site live. First
record findings, then make a focused follow-up change.

## 1. Sync And Verify

```sh
cd /Users/alexis/code/helm-expt
git fetch origin
git pull --ff-only
npm run site:verify
```

If the site verifier fails, stop and report the failing page. Do not start the
UX walkthrough from stale generated HTML.

## 2. Start A Local Static Server

Prefer port `8766`.

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory /Users/alexis/code/helm-expt/site
```

Open:

```text
http://127.0.0.1:8766/
```

If the port is already in use, pick another port:

```sh
python3 -m http.server 8767 --bind 127.0.0.1 --directory /Users/alexis/code/helm-expt/site
```

## 3. Test From Another Laptop

`127.0.0.1` only works on the machine running the server.

The simplest option is to run the same commands on the other laptop.

If the server should run on this machine and be viewed from another laptop on
the same network, bind to all interfaces:

```sh
python3 -m http.server 8766 --bind 0.0.0.0 --directory /Users/alexis/code/helm-expt/site
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

## 4. Six-Step UX Walkthrough

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

### Step 3: Journey

URL:

```text
/journey.html
```

Question:

```text
Are the free, sign-up, server, day-2, and paid boundaries clear?
```

Expected path:

```text
inspect
serverless try-out
first sign-up
ConfigHub Server try-out
day-2 operations
paid features
```

Look for:

- no-account steps are genuinely useful;
- sign-up and paid boundaries are visible;
- ConfigHub value is about variants, operations, policy, and evidence, not only rendering.

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

## 5. Record Findings

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
What Alexis expected:
Suggested fix:
```

## 6. If Fixes Are Requested

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

