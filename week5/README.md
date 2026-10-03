# Week 5 — Reproducible Kubernetes HPL

This week uses HPL as a proof of reproducible platform engineering. The objective is **not** merely the largest GFLOP/s number; it is a benchmark whose source, image, parameters, placement and telemetry can be reproduced and explained.

## Engineering pattern borrowed from `quantum-workflows`

Treat the HPL execution environment as an immutable runner:

```text
source/build inputs
   ↓
CI tests
   ↓
OCI image (sha/digest)
   ↓
Kubernetes Job
   ↓
structured result directory/manifest
   ↓
Prometheus telemetry + analysis
```

Credentials do not belong in the image.

## Implementation order

```text
1. Document HPL/BLAS/MPI build inputs and versions
2. Build pinned OCI image in GitHub Actions
3. Run a tiny CI residual/smoke test
4. Publish immutable GHCR image
5. Create explicit Kubernetes Job resource requests/limits
6. Establish small single-node baseline
7. Record N, NB, P, Q and residual PASS/FAIL
8. Correlate CPU/memory telemetry with benchmark window
9. Calculate an estimated theoretical peak using documented assumptions
10. Run a small controlled parameter/resource study
11. Analyze measured/theoretical gap
12. Optional: multi-node/MPI or scheduler comparison if baseline is solid
```

## HPL result contract

Each accepted run should create a machine-readable manifest like:

```yaml
run_id: <id>
git_commit: <sha>
image_digest: <sha256:...>
execution:
  platform: kubernetes
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
  blas: <name/version>
  mpi: <name/version>
result:
  time_seconds: <value>
  gflops: <value>
  residual_check: PASS|FAIL
telemetry:
  prometheus_window: <start/end>
```

A run with residual `FAIL` is not a valid performance result, but keep it as engineering evidence.

## Kubernetes placement evidence

```bash
# RUN ON: k8s-cp-01
kubectl -n <hpl-namespace> get job,pod -o wide
kubectl -n <hpl-namespace> describe pod <hpl-pod>
kubectl -n <hpl-namespace> logs <hpl-pod>
```

Record the assigned node and requested resources. Do not infer CPU allocation from host size alone.

## Controlled experiment design

Change one major variable at a time: for example CPU request, problem size `N`, block size `NB`, or process grid. Keep enough runs to distinguish repeatability from noise, but do not consume the entire week in blind parameter sweeps.

## Theoretical peak

Document the model used to estimate peak. Virtualised CPU clocks/vector capabilities can make naive estimates misleading. Treat the peak estimate as an assumption-backed comparison, not ground truth.

## Exit gate

You have at least one residual-PASS baseline and a small parameter/resource study, every plotted result traces to an immutable image/run manifest, and Prometheus evidence covers the benchmark windows.
