package main

// The actions. Each one is a Temporal activity: it runs kubectl against one
// context, and a failure is retried by Temporal before the workflow stops.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// Activities holds what every action needs: the cluster to act on.
type Activities struct {
	KubeContext string
}

// StepResult is what one step reports, and what the run log prints.
type StepResult struct {
	Step   string
	Action string
	Output string
}

func (a *Activities) kubectl(ctx context.Context, stdin string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "kubectl", append([]string{"--context", a.KubeContext}, args...)...)
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	err := cmd.Run()
	text := strings.TrimSpace(out.String())
	if err != nil {
		return text, fmt.Errorf("kubectl %s: %w: %s", strings.Join(args, " "), err, text)
	}
	return text, nil
}

// ReadPlanActivity reads the bundle on the worker, so the workflow only ever
// sees the result.
func (a *Activities) ReadPlanActivity(ctx context.Context, dir string) (Plan, error) {
	return ReadPlan(dir)
}

// Apply sends one stage's objects in a single server-side apply.
func (a *Activities) Apply(ctx context.Context, stage ApplyStage) (StepResult, error) {
	var docs []string
	for _, o := range stage.Objects {
		docs = append(docs, o.YAML)
	}
	out, err := a.kubectl(ctx, strings.Join(docs, "---\n"), "apply", "--server-side", "--field-manager", "temporal-plan-runner", "-f", "-")
	return StepResult{Step: stage.Name, Action: fmt.Sprintf("apply %d objects", len(stage.Objects)), Output: out}, err
}

// WaitEstablished waits for named CRDs to report Established.
func (a *Activities) WaitEstablished(ctx context.Context, step string, crds []string) (StepResult, error) {
	args := []string{"wait", "--for=condition=Established", "--timeout=120s"}
	for _, n := range crds {
		args = append(args, "crd/"+n)
	}
	out, err := a.kubectl(ctx, "", args...)
	return StepResult{Step: step, Action: fmt.Sprintf("wait for %d CRDs to be Established", len(crds)), Output: out}, err
}

// RunCheck carries out one lifecycle stage. It reads the bundle again rather
// than receive it, so the workflow history holds step names, not objects.
func (a *Activities) RunCheck(ctx context.Context, dir string, c Check) (StepResult, error) {
	res := StepResult{Step: c.Name, Action: c.Action}
	plan, err := ReadPlan(dir)
	if err != nil {
		return res, err
	}
	var out string
	switch c.Action {
	case "crds-established":
		var names []string
		for _, s := range plan.Apply {
			names = append(names, s.WaitEstablished...)
		}
		r, e := a.WaitEstablished(ctx, c.Name, names)
		out, err = r.Output, e
	case "reapply-crds":
		for _, s := range plan.Apply {
			if len(s.WaitEstablished) > 0 {
				r, e := a.Apply(ctx, s)
				out, err = r.Output, e
			}
		}
	case "deployment-ready":
		ns, name := split(c.Target)
		out, err = a.kubectl(ctx, "", "-n", ns, "rollout", "status", "deployment/"+name, "--timeout=300s")
	case "service-endpoints":
		ns, name := split(c.Target)
		out, err = a.kubectl(ctx, "", "-n", ns, "get", "endpointslices", "-l", "kubernetes.io/service-name="+name,
			"-o", "jsonpath={range .items[*].endpoints[?(@.conditions.ready==true)]}{.addresses[0]}{\"\\n\"}{end}")
		if err == nil && strings.TrimSpace(out) == "" {
			err = fmt.Errorf("service %s has no ready endpoints yet", c.Target)
		}
	case "secret-populated":
		ns, name := split(c.Target)
		out, err = a.kubectl(ctx, "", "-n", ns, "get", "secret", name, "-o", "json")
		if err == nil {
			var s struct{ Data map[string]string }
			_ = json.Unmarshal([]byte(out), &s)
			var missing []string
			for _, k := range []string{"ca.crt", "tls.crt", "tls.key"} {
				if s.Data[k] == "" {
					missing = append(missing, k)
				}
			}
			out = fmt.Sprintf("secret %s holds ca.crt, tls.crt and tls.key", c.Target)
			if len(missing) > 0 {
				err = fmt.Errorf("secret %s has no %s yet", c.Target, strings.Join(missing, ", "))
			}
		}
	case "webhooks-routed":
		out, err = a.webhooksRouted(ctx, plan)
	case "admission-dry-run":
		out, err = a.kubectl(ctx, "", "create", "namespace", "plan-runner-admission-check", "--dry-run=server", "-o", "name")
	default:
		err = fmt.Errorf("no action %q", c.Action)
	}
	res.Output = out
	return res, err
}

// webhooksRouted checks that each webhook configuration in the bundle points
// at a Service in the bundle and carries a CA bundle.
func (a *Activities) webhooksRouted(ctx context.Context, plan Plan) (string, error) {
	var lines []string
	for _, s := range plan.Apply {
		for _, o := range s.Objects {
			if o.Kind != "ValidatingWebhookConfiguration" && o.Kind != "MutatingWebhookConfiguration" {
				continue
			}
			raw, err := a.kubectl(ctx, "", "get", strings.ToLower(o.Kind), o.Name, "-o", "json")
			if err != nil {
				return raw, err
			}
			var w struct {
				Webhooks []struct {
					Name         string
					ClientConfig struct {
						CABundle string `json:"caBundle"`
						Service  *struct{ Name, Namespace string }
					} `json:"clientConfig"`
				}
			}
			_ = json.Unmarshal([]byte(raw), &w)
			for _, h := range w.Webhooks {
				if h.ClientConfig.Service == nil || h.ClientConfig.CABundle == "" {
					return strings.Join(lines, "\n"), fmt.Errorf("%s webhook %s has no service or no CA bundle yet", o.Name, h.Name)
				}
				lines = append(lines, fmt.Sprintf("%s %s -> service %s/%s, CA bundle %d bytes", o.Kind, h.Name, h.ClientConfig.Service.Namespace, h.ClientConfig.Service.Name, len(h.ClientConfig.CABundle)))
			}
		}
	}
	if len(lines) == 0 {
		return "", fmt.Errorf("the bundle has no webhook configurations to check")
	}
	return strings.Join(lines, "\n"), nil
}

func split(target string) (string, string) {
	if i := strings.Index(target, "/"); i >= 0 {
		return target[:i], target[i+1:]
	}
	return "default", target
}
