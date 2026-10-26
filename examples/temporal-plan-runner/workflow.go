package main

// The workflow. It is the same for every bundle: read the plan, wait for a
// person to approve each step no runtime may take on its own, apply the
// objects in the declared order, then run each lifecycle stage in order.
// Temporal keeps the history, retries a failed action, and survives the
// worker restarting while it waits.

import (
	"fmt"
	"sort"
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// ApprovalSignal is the signal a person sends to approve one gate. Its value
// is the step name.
const ApprovalSignal = "approve"

// RunInput says which bundle to run and how long to wait for approval.
type RunInput struct {
	BundleDir       string
	ApprovalTimeout time.Duration
}

// RunRecord is what the workflow returns: every step, in the order it ran.
type RunRecord struct {
	Bundle  string
	Steps   []StepResult
	Covered []string
}

func RunPlan(ctx workflow.Context, in RunInput) (RunRecord, error) {
	ctx = workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 6 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    5 * time.Second,
			BackoffCoefficient: 2,
			MaximumAttempts:    8,
		},
	})
	var a *Activities
	record := RunRecord{Bundle: in.BundleDir}

	var plan Plan
	if err := workflow.ExecuteActivity(ctx, a.ReadPlanActivity, in.BundleDir).Get(ctx, &plan); err != nil {
		return record, err
	}
	record.Covered = plan.Covered

	// Every gate is approved before anything reaches the cluster.
	approvals := workflow.GetSignalChannel(ctx, ApprovalSignal)
	pending := map[string]bool{}
	for _, g := range plan.Gates {
		pending[g.Step] = true
	}
	for len(pending) > 0 {
		var step string
		timedOut := false
		sel := workflow.NewSelector(ctx)
		sel.AddReceive(approvals, func(c workflow.ReceiveChannel, _ bool) { c.Receive(ctx, &step) })
		sel.AddFuture(workflow.NewTimer(ctx, in.ApprovalTimeout), func(workflow.Future) { timedOut = true })
		sel.Select(ctx)
		if timedOut {
			return record, fmt.Errorf("no approval within %s for %v; nothing was applied", in.ApprovalTimeout, keys(pending))
		}
		if !pending[step] {
			workflow.GetLogger(ctx).Warn("approval for a step that is not waiting", "step", step)
			continue
		}
		delete(pending, step)
		record.Steps = append(record.Steps, StepResult{Step: step, Action: "approved by a person", Output: "signal " + ApprovalSignal + " " + step})
	}

	sort.Slice(plan.Apply, func(i, j int) bool { return plan.Apply[i].Order < plan.Apply[j].Order })
	for _, stage := range plan.Apply {
		var r StepResult
		if err := workflow.ExecuteActivity(ctx, a.Apply, stage).Get(ctx, &r); err != nil {
			return record, fmt.Errorf("stage %s: %w", stage.Name, err)
		}
		record.Steps = append(record.Steps, r)
		if len(stage.WaitEstablished) > 0 {
			if err := workflow.ExecuteActivity(ctx, a.WaitEstablished, stage.Name+" established", stage.WaitEstablished).Get(ctx, &r); err != nil {
				return record, err
			}
			record.Steps = append(record.Steps, r)
		}
	}

	sort.Slice(plan.Checks, func(i, j int) bool { return plan.Checks[i].Order < plan.Checks[j].Order })
	for _, c := range plan.Checks {
		var r StepResult
		if err := workflow.ExecuteActivity(ctx, a.RunCheck, in.BundleDir, c).Get(ctx, &r); err != nil {
			return record, fmt.Errorf("lifecycle stage %d %s: %w", c.Order, c.Name, err)
		}
		record.Steps = append(record.Steps, r)
	}
	return record, nil
}

func keys(m map[string]bool) []string {
	var out []string
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
