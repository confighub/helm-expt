# Check a chart render on every pull request

Both the Flux and the Kustomize workflows reviewed here live in pull requests,
so the natural place to see what a values change does is the PR itself. This
workflow renders the chart on every pull request and posts the object diff as
a comment. It needs no ConfigHub account and no server: everything runs inside
the GitHub runner.

```yaml
name: render-check
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Install helm
        uses: azure/setup-helm@v4
      - name: Render both sides
        run: |
          helm template rel ./chart -f values.yaml --include-crds > pr.yaml
          git fetch origin ${{ github.base_ref }} --depth 1
          git checkout origin/${{ github.base_ref }} -- values.yaml || true
          helm template rel ./chart -f values.yaml --include-crds > base.yaml
      - name: Validate the rendered objects
        run: |
          curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
          ./kubeconform -summary -ignore-missing-schemas pr.yaml
      - name: Diff and comment
        run: |
          diff -u base.yaml pr.yaml > render.diff || true
          {
            echo '### Rendered object diff'
            echo '```diff'
            head -200 render.diff
            echo '```'
          } > comment.md
          gh pr comment ${{ github.event.pull_request.number }} --body-file comment.md
        env:
          GH_TOKEN: ${{ github.token }}
```

Adjust the chart path and values file to your layout. The `head -200` keeps a
large diff from flooding the PR; the full diff stays in the job log. The
kubeconform step validates every rendered object against the Kubernetes schema
before the diff posts, so a values change that renders an invalid object fails
the check instead of shipping. `-ignore-missing-schemas` keeps CRD-defined
kinds from failing the run; drop it if you also publish schemas for your CRDs.
For a Kustomize overlay, the same shape works with `kustomize build` in place
of `helm template` on both sides.

For charts in this catalog, the committed render receipts give you the same
comparison against the reviewed baseline instead of against your own previous
render.
