# traefik/traefik 41.4.0 Proof

This is the exact-artifact ConfigHub component package for the traefik@41.4.0 dependency selected by Kubara catalogs 3.0.

Variants:

- `default`: chart defaults; 31 Helm objects, 32 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked without a mutable Helm index lookup;
- the selected configuration renders deterministically and the installer package preserves the rendered object set;
- Catalog retention does not imply Kubara wrapper equivalence, live convergence, or production support.

Useful commands:

```sh
npm run kubara-catalog-3.0-coverage:generate-proof
npm run kubara-catalog-3.0-coverage:generate-package
npm run kubara-catalog-3.0-coverage:verify-proof
npm run kubara-catalog-3.0-coverage:verify-package
npm run kubara-catalog-3.0-coverage:compare
```
