# Part B — Fresh Security Detection Drill

## Action
A benign new SSH connection from the team workstation to `edge-01`
matched a temporary Suricata alert-only signature:

- Signature: `WEEK3 benign SSH detection drill`
- Suricata signature ID: `1000001`
- Action: `allowed`
- Destination: `10.83.0.110:22`
- Source observed for the primary event: `169.0.118.159:48316`

This was a TCP/SSH connection detection, not an authentication-failure test.

## Timeline
All timestamps UTC, 27 October 2026.

- Drill start marker: `22:41:28Z`
- Drill end marker: `22:41:29Z`
- Suricata event: `22:41:28.872750Z`
- Wazuh alert timestamp: `22:41:29.825Z`
- Wazuh indexer document timestamp: `22:41:29.825Z`

The system timestamps show the event arriving at Wazuh shortly after Suricata recorded it.

## Evidence chain

1. **Platform health:** `wazuh-manager` and `suricata` both reported `active`.
2. **Suricata:** `/var/log/suricata/eve.json` contained the alert with SID `1000001`.
3. **Wazuh Manager:** `/var/ossec/logs/alerts/alerts.json` contained:
   - Rule ID: `86601`
   - Level: `3`
   - Description: `Suricata: Alert - WEEK3 benign SSH detection drill`
   - Agent: `edge-01.novalocal` (manager agent ID `000`)
4. **Wazuh indexer:** document found in:
   - Index: `wazuh-alerts-4.x-2026.10.27`
   - Document ID: `fzSGf6EB8iqDhe5wpHF_`
   - Indexed rule ID: `86601`
   - Indexed signature ID: `1000001`
5. **Prometheus:** historical `up` query evaluated at `2026-10-27T22:41:29Z`.
   See `monitoring-health.md` for target results and caveats.

## Cleanup
The original Suricata rules file was restored from
`/tmp/suricata.rules.week3-drill.bak`, and the rules were reloaded.

Final reported ruleset:
- Rules loaded: `53256`
- Rules failed: `0`
- Temporary SID `1000001` absent from the restored rules file.

## Result
The fresh event was verified through Suricata EVE JSON, Wazuh Manager
alerts and the Wazuh indexer. Prometheus health was queried at the event
time; six scrape targets reported `up=0` and are documented separately.
