#!/usr/bin/env python3
"""Deterministic target discovery controls, not live acceptance receipts."""
import importlib.util
import importlib.machinery
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True

loader = importlib.machinery.SourceFileLoader("parity_runner", str(Path(__file__).with_name("live-helm-confighub-parity-test")))
spec = importlib.util.spec_from_loader(loader.name, loader)
runner = importlib.util.module_from_spec(spec)
loader.exec_module(runner)


def target(slug="target", target_id="target-id"):
    return {"Target": {"Slug": slug, "TargetID": target_id, "SpaceSlug": "rig",
                       "Annotations": {"confighub.com/argo-apps-space": "rig-argo-apps"}}}


class TargetDiscovery(unittest.TestCase):
    def discover(self, targets, binding="target-id", denied=False):
        def command(args, **kwargs):
            self.assertIn("-o", args)
            self.assertIn("json", args)
            if args[1:3] == ["target", "list"]:
                if args[args.index("--space") + 1] != "rig":
                    return 1, "", "space not found"
                return 0, targets if isinstance(targets, str) else json.dumps(targets), ""
            if args[1:3] == ["space", "get"]:
                if denied:
                    return 1, "", "permission denied"
                return 0, json.dumps({"Space": {"Slug": "rig-argo-apps", "ReleaseTargetID": binding}}), ""
            self.fail(f"unexpected command {args}")
        with patch.object(runner, "sh", side_effect=command):
            return runner.discover_cluster_oci_target("rig")

    def test_isolated_cub_config_controls_cluster_kubeconfig(self):
        with patch.dict(runner.os.environ, {"CUB_CONFIG": "/isolated-cub-config"}):
            self.assertEqual(runner.cluster_kubeconfig_for_profile("none", "rig"), Path("/isolated-cub-config/clusters/rig.kubeconfig"))

    def test_default_cluster_kubeconfig_remains_in_user_config(self):
        with patch.dict(runner.os.environ, {}, clear=True):
            self.assertEqual(runner.cluster_kubeconfig_for_profile("none", "rig"), Path.home() / ".confighub/clusters/rig.kubeconfig")

    def test_exact_bound_target_without_human_oci_column(self):
        self.assertEqual(self.discover([target()])[:3], ("rig", "target", "rig-argo-apps"))

    def test_order_independent_with_unrelated_target(self):
        unrelated = {"Target": {"Slug": "other", "TargetID": "other-id", "SpaceSlug": "rig"}}
        for entries in ([target(), unrelated], [unrelated, target()]):
            self.assertEqual(self.discover(entries)[:3], ("rig", "target", "rig-argo-apps"))

    def test_missing_annotation_is_blocked(self):
        t = target(); t["Target"]["Annotations"] = {}
        with self.assertRaises(RuntimeError): self.discover([t])

    def test_wrong_release_binding_is_blocked(self):
        with self.assertRaises(RuntimeError): self.discover([target()], binding="another-target")

    def test_denied_apps_space_is_blocked(self):
        with self.assertRaises(RuntimeError): self.discover([target()], denied=True)

    def test_ambiguous_targets_are_blocked(self):
        with self.assertRaises(RuntimeError): self.discover([target(), target("other", "other-id")])

    def test_malformed_successful_response_is_blocked(self):
        for value in ("not-json", "{}", '[{"Target": {}}]'):
            with self.subTest(value=value), self.assertRaises(RuntimeError): self.discover(value)


class OCIRegistryBinding(unittest.TestCase):
    def test_public_and_local_root_authorities_are_preserved(self):
        for authority in ("oci.hub.confighub.com:443", "192.168.97.1:32281"):
            self.assertEqual(runner.workload_oci_repo_url(f"oci://{authority}/space/apps", "apps", "workload"), f"oci://{authority}/space/workload")

    def test_wrong_scope_protocol_and_credentials_are_refused(self):
        for url in ("oci://registry/space/other", "https://registry/space/apps",
                    "oci://user:password@registry/space/apps", "oci://registry/space/apps?token=x",
                    "oci://registry/space/apps#fragment", "oci:///space/apps", "not-a-url"):
            with self.subTest(url=url), self.assertRaises(RuntimeError):
                runner.workload_oci_repo_url(url, "apps", "workload")

    def test_workload_space_cannot_escape_registry_path(self):
        for space in ("", "../other", "one/two", "a?token=x", "a#fragment"):
            with self.subTest(space=space), self.assertRaises(RuntimeError):
                runner.workload_oci_repo_url("oci://registry/space/apps", "apps", space)


if __name__ == "__main__": unittest.main()
