# Part A — Monitoring Health Evidence

Historical query:
- Metric: `up`
- Evaluation time: `2026-10-27T22:41:29Z`
- Prometheus API returned `status: success`.

## Workloads observed running
- Prometheus StatefulSet pod: `prometheus-monitoring-kube-prometheus-prometheus-0` (2/2 containers)
- Grafana pod: `monitoring-grafana-5bc89d49c-fn4b5` (3/3 containers)
- kube-state-metrics: running
- Prometheus node exporters: running on control plane and both workers

## Scrape targets reporting up=1
- Prometheus, config-reloader, Grafana and kube-state-metrics
- All three node exporters
- Kubernetes API server
- CoreDNS
- Kubelet metrics, cAdvisor and probes on the three Kubernetes nodes
- Monitoring operator endpoint

## Scrape targets reporting up=0 at the queried time
- kube-controller-manager: `10.83.0.68:10257`
- etcd: `10.83.0.68:2381`
- kube-scheduler: `10.83.0.68:10259`
- kube-proxy: `10.83.0.68:10249`
- kube-proxy: `10.83.0.160:10249`
- kube-proxy: `10.83.0.251:10249`

These are observed scrape results, not proof those components were down.
Review scrape configuration and target health separately if required by the assessment.
