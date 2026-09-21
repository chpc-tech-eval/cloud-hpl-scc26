# Cloud-to-Cluster — Reproducible HPC Platform Engineering & HPL

**Repository:** `cloud-hpl-scc26`  
**Recommended long name:** **Cloud-to-Cluster: Reproducible HPC Platform Engineering & HPL**  
**Duration:** 10-week core, 12 weeks with stretch/handover

## Project summary

This project asks students to build a clean, reproducible path from an empty OpenStack project to a working Kubernetes-hosted High Performance LINPACK (HPL) demonstration, while preserving the architectural separation between infrastructure, Kubernetes services and HPC scheduling.

HPL is the proof point, not the whole project. The real learning objective is to understand the chain:

```text
OpenStack -> Terraform -> Ansible -> Kubernetes -> Cilium/Cinder -> Argo CD
          -> monitoring -> reproducible HPL image/job -> benchmark evidence
```

The project should also expose students to Slurm and the larger `quantum-platform`/`quantum-workflows` environment without pretending that Kubernetes replaces Slurm for every HPC workload. A Kubernetes HPL run demonstrates container orchestration and reproducibility; Slurm remains the natural scheduler for production-style multi-node HPC work in the wider architecture.

## Core question

> Can a student team rebuild the baseline platform from code and produce an HPL result whose software stack, resource placement, parameters and performance evidence are completely reproducible?

## Primary integrations

- `infra-hpc-qc-k8s` — primary infrastructure and GitOps integration target;
- `quantum-platform` — optional status/result surface and authenticated launch request;
- `quantum-workflows` — provenance conventions, immutable runner concepts and future workload interface;
- `agent-control-plane` — read-only diagnostic evidence as a stretch integration;
- `chpc-tech-eval/scc` — HPL and cluster-engineering learning lineage.

## Learning outcomes

Students should be able to:

- explain Terraform, Ansible, Kubernetes, Argo CD and Slurm ownership boundaries;
- deploy OpenStack resources reproducibly;
- verify Kubernetes networking, storage and ingress prerequisites;
- build and publish an immutable HPL runner image;
- model CPU/memory placement and topology constraints;
- run HPL as a Kubernetes workload;
- collect benchmark configuration and performance evidence;
- compare measured performance with an estimated theoretical peak;
- diagnose a failed deployment from logs/metrics rather than rebuilding blindly;
- explain why a result is reproducible or why it is not.

## Scope

### Must deliver

1. A documented minimal infrastructure profile that can be deployed in a student OpenStack project.
2. Terraform plan/apply validation and safe destroy/rebuild procedure.
3. Ansible configuration for the required hosts.
4. A working Kubernetes cluster with Cilium and persistent storage where the environment provides it.
5. Argo CD deployment path for project-owned Kubernetes manifests.
6. Prometheus/Grafana visibility of nodes/pods used by the HPL run.
7. A versioned HPL OCI image with pinned build inputs.
8. A Kubernetes HPL job for a single-node baseline.
9. Structured benchmark output including commit/image digest, HPL parameters and assigned resources.
10. A documented comparison against theoretical peak and an explanation of the gap.

### Should deliver

- multi-node MPI HPL on Kubernetes using a reviewed MPI orchestration approach;
- automated benchmark result ingestion and visualisation;
- a Slurm HPL comparison using the same or equivalent build inputs;
- a small `quantum-platform` administrator/researcher page showing run metadata;
- failure-injection exercise such as unavailable storage, image-pull failure or insufficient resources.

### Stretch

- CPU pinning/NUMA/topology experiments;
- alternative BLAS/MPI implementations;
- HPL parameter sweep controlled by a reproducible experiment manifest;
- agent-control-plane read-only diagnostic that explains failed HPL jobs;
- reusable workload contract aligned with `quantum-workflows` provenance.

## Non-goals

- benchmarking every SCC application;
- replacing Slurm with Kubernetes;
- prematurely adding GPU/QPU complexity before the CPU HPL path is solid;
- hand-configuring a snowflake cluster that cannot be rebuilt;
- tuning solely for the largest GFLOP/s number while losing provenance.

## Architecture

```text
Git repository
    │
    ├── Terraform ───────> OpenStack network/VMs/volumes/security groups
    │
    └── Ansible ─────────> host configuration
                              │
                              ▼
                         Kubernetes
                              │
                ┌─────────────┼─────────────┐
                │             │             │
             Cilium        Cinder CSI     Argo CD
                                              │
                                              ▼
                                      HPL workload image
                                              │
                                     Kubernetes Job/MPI
                                              │
                         ┌────────────────────┴─────────────┐
                         ▼                                  ▼
                  HPL result/provenance              Prometheus/Grafana
```

## Repository layout

```text
cloud-hpl-scc26/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── HPL-METHODOLOGY.md
│   └── TROUBLESHOOTING.md
├── image/
│   └── hpl/
├── k8s/
│   ├── base/
│   └── overlays/
├── experiments/
│   ├── baseline/
│   └── schemas/
├── scripts/
├── tests/
└── .github/workflows/
```

Infrastructure that clearly belongs in `infra-hpc-qc-k8s` should be upstreamed rather than permanently copied here. This project repository owns the student experiment, validation harness and HPL integration work.

## HPL evidence contract

Every recorded run should capture at least:

```yaml
run_id: <uuid-or-timestamp>
git_commit: <commit>
image_digest: <immutable-image-digest>
kubernetes_context: <redacted-logical-name>
node_count: 1
cpu_request: <value>
memory_request: <value>
hpl:
  N: <value>
  NB: <value>
  P: <value>
  Q: <value>
software:
  hpl: <version>
  blas: <implementation/version>
  mpi: <implementation/version>
result:
  time_seconds: <value>
  gflops: <value>
  residual_check: PASS|FAIL
```

Do not store cloud credentials, kubeconfigs or private infrastructure secrets in benchmark artifacts.

## Ten-week roadmap

### Week 1 — Architecture and manual baseline

- reproduce the relevant SCC HPL learning path manually;
- map every manual action to its eventual automation owner;
- define minimal OpenStack resource requirements;
- estimate theoretical peak for the selected VM resources.

**Exit:** HPL runs manually on one host and students can explain every dependency.

### Week 2 — Infrastructure as code

- Terraform deploy/destroy;
- Ansible connectivity and baseline configuration;
- smoke tests for network, DNS, time and package prerequisites.

**Exit:** clean rebuild of the minimal environment.

### Week 3 — Kubernetes baseline

- control plane/workers healthy;
- Cilium validation;
- storage validation where required;
- Argo CD ready;
- node/pod telemetry visible.

### Week 4 — Immutable HPL runner

- container build;
- pinned HPL/BLAS/MPI inputs;
- CI smoke test;
- image digest recorded.

**Exit:** local/container HPL residual test passes.

### Week 5 — Kubernetes HPL

- deploy single-node HPL Job;
- collect logs/results automatically;
- show node placement and resource requests;
- correlate result with Prometheus telemetry.

**Exit:** reproducible Kubernetes HPL result.

### Week 6 — Performance methodology

- parameter study for `N`, `NB`, process grid and CPU allocation;
- compare against theoretical peak;
- explain CPU, memory and virtualisation constraints.

### Week 7 — Multi-node or Slurm comparison

Preferred path: multi-node MPI on Kubernetes. If infrastructure limits make that impractical, perform a rigorous Slurm comparison using the same methodology.

**Exit:** second scheduler/execution path with comparable provenance.

### Week 8 — Failure and recovery

Intentionally break one component at a time: image reference, resource request, networking, storage or application parameters. Write troubleshooting trees and automate checks.

### Week 9 — Staging release

Deploy from `stag`, run the full conformance suite and benchmark matrix, freeze results and resolve reproducibility defects.

### Week 10 — Final demo

Start from documented prerequisites, deploy, run HPL, show metrics, explain theoretical vs measured performance, demonstrate one failure diagnosis and release `main`.

### Weeks 11–12 — Stretch

NUMA/topology tuning, multi-node MPI hardening, UI integration and upstream PRs.

## Acceptance criteria

The project passes when another student can follow the documentation from a clean supported starting point, produce a passing HPL residual check in Kubernetes, identify the exact image and source commit that ran, reproduce the HPL input parameters, and explain the measured performance using system telemetry.

## Upstream contribution targets

- `infra-hpc-qc-k8s`: validated deployment improvements, Argo application definitions, monitoring checks, optional HPL teaching workload;
- `quantum-platform`: optional workload/run summary UI;
- `quantum-workflows`: reusable provenance/result schema ideas;
- `chpc-tech-eval/scc`: modern HPL/IaC tutorial improvements proven by the student project.
