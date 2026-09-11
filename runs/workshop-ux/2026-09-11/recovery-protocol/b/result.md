# Workshop recovery trial result

The supplied `platform-moved/` workspace was retained as the composed baseline. Its existing certification is `certified: true` for 184 objects, with static scope: target availability and application health are `not-checked`.

In a separate copy, `incompatible/`, I changed only `components/06-shop-web.yaml`'s `ExternalSecret/shop-web-db` API version from `external-secrets.io/v1` to `external-secrets.io/v1beta1`. Certification refused it with exit code 1 and preserved the result at `incompatible/refusal.json` (inside workspace.tar.gz). The failure says the bundled `externalsecrets.external-secrets.io` CRD serves `v1`; `v1beta1` is `version-not-served`. The failed attempt remains intact.

Recovery was performed in another copy, `recovered/`, by restoring that one field to `external-secrets.io/v1`. Certification then exited 0 and wrote `recovered/recovery-result.json` (inside workspace.tar.gz); sandbox rendering exited 0 and wrote `recovered/recovered.yaml` (inside workspace.tar.gz). The recovered render hash is `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`, matching the supplied changed render hash.

Evidence is local static composition only. No cluster, credentials, ConfigHub account, registry, GitOps controller, target namespaces, issuer, secret store, workload scheduling, or application response was contacted or observed. The results therefore do not prove live delivery or that the app runs. Public context consulted, if needed, was the Workshop site release [15d0774b388d3e436971005649d98b4010a20304](https://confighub.github.io/helm-expt/site/).
