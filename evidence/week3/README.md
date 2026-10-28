# Week 3 Evidence — Parts A and B

Date: 27 October 2026 (UTC)

## Part A — Prometheus and Grafana
- Prometheus, Grafana, kube-state-metrics and node exporters were deployed.
- Historical Prometheus `up` query checked at 2026-10-27 22:41:29 UTC.
- 20 scrape targets reported `up=1`; 6 reported `up=0`.
- See [monitoring-health.md](monitoring-health.md) for the observed target states.

## Part B — Wazuh and Suricata
- Wazuh Manager and Suricata were active during the drill.
- A benign SSH connection triggered a temporary Suricata test signature.
- The event was recorded by Suricata, Wazuh Manager and the Wazuh indexer.
- The temporary signature was removed afterwards.
- Suricata returned to 53,256 loaded rules, with 0 failed.

See [detection-drill.md](detection-drill.md) for timestamps and event identifiers.

## Handover
Parts A and B evidence is recorded. Parts C and D are handed to the next teammate.

Security drill evidence is a benign SSH connection alert, not a failed-login test.
