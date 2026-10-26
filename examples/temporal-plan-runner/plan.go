package main

// Reading a bundle's plan. A Catalog bundle carries its objects in
// upstream.yaml and one plan document per step under routes/. This file turns
// those documents into the steps the workflow runs, and refuses any step it
// cannot name an action for.

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// Object is one Kubernetes object from upstream.yaml, kept as its YAML so the
// apply sends exactly the bytes the bundle holds.
type Object struct {
	Kind      string
	Name      string
	Namespace string
	YAML      string
}

// Gate is a plan step that no runtime may carry out on its own
// (automatic: false). The workflow waits for a person to approve it.
type Gate struct {
	Step      string
	Phase     string
	Discharge string
}

// ApplyStage is one stage of the apply-ordering document.
type ApplyStage struct {
	Order           int
	Name            string
	Objects         []Object
	WaitEstablished []string // CRD names to wait for after the stage
}

// Check is one lifecycle stage and the action that carries it out.
type Check struct {
	Order  int
	Name   string
	Action string // see actions in activities.go
	Target string // the object the action reads, from the bundle
	Detail string // the plan's own words for what was observed
}

// Plan is everything the workflow needs, read once from the bundle.
type Plan struct {
	Bundle  string
	Gates   []Gate
	Apply   []ApplyStage
	Checks  []Check
	Covered []string // lifecycle stages the ordered apply already performs
}

type route struct {
	Kind     string `yaml:"kind"`
	Metadata struct {
		Name string `yaml:"name"`
	} `yaml:"metadata"`
	Spec struct {
		RouteKind   string `yaml:"routeKind"`
		Discharges  string `yaml:"discharges"`
		Declaration struct {
			Step   string `yaml:"step"`
			Phase  string `yaml:"phase"`
			Stages []struct {
				Order    int    `yaml:"order"`
				Name     string `yaml:"name"`
				WaitFor  string `yaml:"waitFor"`
				Observed string `yaml:"observedDetail"`
				Selector struct {
					Kinds []string `yaml:"kinds"`
					Names []string `yaml:"names"`
				} `yaml:"selector"`
			} `yaml:"stages"`
		} `yaml:"declaration"`
		ExecutedBy struct {
			Automatic *bool `yaml:"automatic"`
		} `yaml:"executedBy"`
	} `yaml:"spec"`
}

// ReadPlan reads a bundle directory: upstream.yaml and routes/*.yaml.
func ReadPlan(dir string) (Plan, error) {
	objects, err := readObjects(filepath.Join(dir, "upstream.yaml"))
	if err != nil {
		return Plan{}, err
	}
	files, _ := filepath.Glob(filepath.Join(dir, "routes", "*.yaml"))
	sort.Strings(files)
	if len(files) == 0 {
		return Plan{}, fmt.Errorf("%s has no routes/*.yaml, so there is no plan to run", dir)
	}
	plan := Plan{Bundle: dir}
	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			return Plan{}, err
		}
		var r route
		if err := yaml.Unmarshal(raw, &r); err != nil {
			return Plan{}, fmt.Errorf("%s: %w", file, err)
		}
		switch r.Spec.RouteKind {
		case "apply-ordering":
			stages, err := applyStages(r, objects)
			if err != nil {
				return Plan{}, fmt.Errorf("%s: %w", file, err)
			}
			plan.Apply = stages
		case "lifecycle-job":
			for _, s := range r.Spec.Declaration.Stages {
				action, target, err := lifecycleAction(s.Name, objects)
				if err != nil {
					return Plan{}, fmt.Errorf("%s: stage %d %q: %w", file, s.Order, s.Name, err)
				}
				if action == "covered-by-apply" {
					plan.Covered = append(plan.Covered, s.Name)
					continue
				}
				plan.Checks = append(plan.Checks, Check{Order: s.Order, Name: s.Name, Action: action, Target: target, Detail: s.Observed})
			}
		case "recorded-plan-step":
			if r.Spec.ExecutedBy.Automatic == nil || *r.Spec.ExecutedBy.Automatic {
				return Plan{}, fmt.Errorf("%s: a recorded plan step that claims to be automatic has no action here", file)
			}
			plan.Gates = append(plan.Gates, Gate{Step: r.Spec.Declaration.Step, Phase: r.Spec.Declaration.Phase, Discharge: r.Spec.Discharges})
		default:
			return Plan{}, fmt.Errorf("%s: route kind %q has no action in this runner, and the plan says to stop rather than skip", file, r.Spec.RouteKind)
		}
	}
	if len(plan.Apply) == 0 {
		return Plan{}, fmt.Errorf("%s: no apply-ordering document, so the runner cannot know the apply order", dir)
	}
	return plan, nil
}

func readObjects(path string) ([]Object, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var out []Object
	dec := yaml.NewDecoder(bytes.NewReader(raw))
	for {
		var node yaml.Node
		if err := dec.Decode(&node); err == io.EOF {
			break
		} else if err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		var meta struct {
			Kind     string `yaml:"kind"`
			Metadata struct {
				Name      string `yaml:"name"`
				Namespace string `yaml:"namespace"`
			} `yaml:"metadata"`
		}
		if err := node.Decode(&meta); err != nil || meta.Kind == "" {
			continue
		}
		text, err := yaml.Marshal(&node)
		if err != nil {
			return nil, err
		}
		out = append(out, Object{Kind: meta.Kind, Name: meta.Metadata.Name, Namespace: meta.Metadata.Namespace, YAML: string(text)})
	}
	return out, nil
}

// applyStages splits the objects into the declared stages. A named selector
// takes exactly those objects; a "*" stage takes what no earlier stage took.
func applyStages(r route, objects []Object) ([]ApplyStage, error) {
	taken := map[int]bool{}
	var stages []ApplyStage
	for _, s := range r.Spec.Declaration.Stages {
		stage := ApplyStage{Order: s.Order, Name: s.Name}
		wild := len(s.Selector.Kinds) == 1 && s.Selector.Kinds[0] == "*"
		names := map[string]bool{}
		for _, n := range s.Selector.Names {
			names[n] = true
		}
		for i, o := range objects {
			if taken[i] {
				continue
			}
			if wild || (contains(s.Selector.Kinds, o.Kind) && (len(names) == 0 || names[o.Name])) {
				stage.Objects = append(stage.Objects, o)
				taken[i] = true
			}
		}
		if len(s.Selector.Names) > 0 && len(stage.Objects) != len(s.Selector.Names) {
			return nil, fmt.Errorf("stage %q names %d objects and the bundle holds %d of them", s.Name, len(s.Selector.Names), len(stage.Objects))
		}
		if strings.Contains(s.WaitFor, "Established") {
			for _, o := range stage.Objects {
				stage.WaitEstablished = append(stage.WaitEstablished, o.Name)
			}
		}
		stages = append(stages, stage)
	}
	if len(taken) != len(objects) {
		return nil, fmt.Errorf("the stages take %d of the bundle's %d objects", len(taken), len(objects))
	}
	return stages, nil
}

// lifecycleAction names the action for a lifecycle stage, and the bundle
// object it reads. These names are the vocabulary the recorded run used. A
// name outside it is an error, because the plan says to stop, not to skip.
func lifecycleAction(name string, objects []Object) (string, string, error) {
	one := func(kind, suffix string) (string, error) {
		var found []string
		for _, o := range objects {
			if o.Kind == kind && strings.HasSuffix(o.Name, suffix) {
				found = append(found, namespaced(o))
			}
		}
		if len(found) != 1 {
			return "", fmt.Errorf("expected one %s ending in %q in the bundle, found %d", kind, suffix, len(found))
		}
		return found[0], nil
	}
	base := strings.TrimPrefix(name, "pre-upgrade-")
	switch {
	case name == "cub-installer-setup", name == "kubectl-apply-separated-secrets", name == "kubectl-apply-manifests":
		return "covered-by-apply", "", nil
	case name == "pre-upgrade-crd-route-apply":
		return "reapply-crds", "", nil
	case base == "crds-established":
		return "crds-established", "", nil
	case strings.HasSuffix(name, "-ready"):
		t, err := one("Deployment", strings.TrimSuffix(name, "-ready"))
		return "deployment-ready", t, err
	case name == "webhook-service-endpoints":
		t, err := one("Service", "webhook-service")
		return "service-endpoints", t, err
	case name == "webhook-secret-populated":
		t, err := one("Secret", "webhook-server-cert")
		return "secret-populated", t, err
	case base == "webhook-configurations-routed":
		return "webhooks-routed", "", nil
	case base == "admission-server-dry-run":
		return "admission-dry-run", "", nil
	}
	return "", "", fmt.Errorf("no action for this stage name")
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func namespaced(o Object) string {
	if o.Namespace == "" {
		return o.Name
	}
	return o.Namespace + "/" + o.Name
}
