# Where does this vulnerable image run, and how can I update it safely?

A platform SRE asks a keystone question about bitnami/redis 25.5.3. The
assistant does the easy part, placing the image across the fleet; the gate does the
safe part, refusing to misplace it or miss an environment, by checking every claim
against the committed fleet blast-radius matrix.

## Where the image runs

Changing image.digest reaches the workloads in
**dev, prod-us-east, staging**, 2 objects each, the Redis
StatefulSets.

## Where it is shielded

**prod-eu-west** is shielded: an
environment override pins image.digest there, so a fleet-wide
change does not reach it. That is the trap the question is about, and it is why a safe
update rolls out to the reachable environments and handles the shielded one on its
own.

## The safe update

Change the digest at the base. It propagates to the reachable environments, two
objects each. The shielded environment keeps its pinned digest and needs a separate,
deliberate change, so nothing silently reverts or is silently missed.

## The gate

- Every environment the answer places the image in matches the matrix status.
- Every affected object list matches the matrix.
- Every shielded environment matches, including what shields it.
- Every environment in the matrix is answered, so none is dropped.

The self-test mutates the answer three ways, a shielded environment called reachable,
a wrong affected-object list, and a dropped environment, and confirms the gate rejects
each. So the answer is the assistant, and the fleet matrix is the authority.

## The limit

This reads a committed desired-configuration blast-radius matrix. It reports where a
digest change reaches or is shielded across recorded environments; it does not scan a
live cluster or a live registry for the running image.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The fleet facts the gate derived](./fleet-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-fleet-image.yaml)
- [The fleet blast-radius matrix](../../data/blast-radius-fleet/matrix.csv)

Run:

```bash
npm run ai-fleet-image:verify
npm run ai-fleet-image:self-test
```
