// Command plan-runner runs a Catalog bundle's plan as a Temporal workflow.
//
//	plan-runner plan   <bundle-dir>                  print the steps, run nothing
//	plan-runner worker --kube-context <ctx>          run the worker
//	plan-runner start  [--id <id>] <bundle-dir>      start a run and print its result
//
// A person approves each gate with the Temporal CLI:
//
//	temporal workflow signal --workflow-id <id> --name approve --input '"<step>"'
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

const taskQueue = "catalog-plan"

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	switch os.Args[1] {
	case "plan":
		fs := flag.NewFlagSet("plan", flag.ExitOnError)
		_ = fs.Parse(os.Args[2:])
		if fs.NArg() != 1 {
			usage()
		}
		plan, err := ReadPlan(fs.Arg(0))
		if err != nil {
			log.Fatal(err)
		}
		printPlan(plan)
	case "worker":
		fs := flag.NewFlagSet("worker", flag.ExitOnError)
		kube := fs.String("kube-context", "", "the kubectl context to act on (required)")
		_ = fs.Parse(os.Args[2:])
		if *kube == "" {
			usage()
		}
		c := dial()
		defer c.Close()
		w := worker.New(c, taskQueue, worker.Options{})
		w.RegisterWorkflow(RunPlan)
		w.RegisterActivity(&Activities{KubeContext: *kube})
		if err := w.Run(worker.InterruptCh()); err != nil {
			log.Fatal(err)
		}
	case "start":
		fs := flag.NewFlagSet("start", flag.ExitOnError)
		id := fs.String("id", "", "workflow id (default: plan-<bundle dir name>)")
		wait := fs.Duration("approval-timeout", time.Hour, "how long to wait for approvals")
		_ = fs.Parse(os.Args[2:])
		if fs.NArg() != 1 {
			usage()
		}
		dir := fs.Arg(0)
		if *id == "" {
			*id = "plan-" + baseName(dir)
		}
		c := dial()
		defer c.Close()
		run, err := c.ExecuteWorkflow(context.Background(), client.StartWorkflowOptions{ID: *id, TaskQueue: taskQueue}, RunPlan, RunInput{BundleDir: dir, ApprovalTimeout: *wait})
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("started workflow %s, run %s\n", run.GetID(), run.GetRunID())
		var rec RunRecord
		err = run.Get(context.Background(), &rec)
		out, _ := json.MarshalIndent(rec, "", "  ")
		fmt.Println(string(out))
		if err != nil {
			log.Fatal(err)
		}
	default:
		usage()
	}
}

func dial() client.Client {
	c, err := client.Dial(client.Options{HostPort: envOr("TEMPORAL_ADDRESS", "127.0.0.1:7233")})
	if err != nil {
		log.Fatal(err)
	}
	return c
}

func printPlan(p Plan) {
	fmt.Printf("Bundle %s\n\nGates (a person approves each before anything is applied)\n", p.Bundle)
	for _, g := range p.Gates {
		fmt.Printf("  %-28s phase %-10s %s\n", g.Step, g.Phase, g.Discharge)
	}
	fmt.Println("\nApply, in order")
	for _, s := range p.Apply {
		wait := ""
		if len(s.WaitEstablished) > 0 {
			wait = fmt.Sprintf(", then wait for %d CRDs to be Established", len(s.WaitEstablished))
		}
		fmt.Printf("  %d. %-26s %d objects%s\n", s.Order, s.Name, len(s.Objects), wait)
	}
	fmt.Println("\nLifecycle stages, in order")
	for _, c := range p.Checks {
		target := ""
		if c.Target != "" {
			target = " " + c.Target
		}
		fmt.Printf("  %2d. %-42s %s%s\n", c.Order, c.Name, c.Action, target)
	}
	fmt.Printf("\nAlready done by the ordered apply: %v\n", p.Covered)
}

func envOr(k, v string) string {
	if s := os.Getenv(k); s != "" {
		return s
	}
	return v
}

func baseName(dir string) string {
	for len(dir) > 1 && dir[len(dir)-1] == '/' {
		dir = dir[:len(dir)-1]
	}
	for i := len(dir) - 1; i >= 0; i-- {
		if dir[i] == '/' {
			return dir[i+1:]
		}
	}
	return dir
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: plan-runner plan <bundle-dir> | worker --kube-context <ctx> | start [--id <id>] [--approval-timeout 1h] <bundle-dir>")
	os.Exit(2)
}
