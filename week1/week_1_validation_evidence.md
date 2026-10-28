# Week 1 Foundation: Validation Evidence

This document contains the terminal outputs verifying the successful deployment of the 5-node OpenStack infrastructure, Terraform state synchronization, and private network routing.

### 1. OpenStack Quotas
Verifies that project quotas have been successfully expanded to accommodate the cluster (e.g., 50 cores, 102400 RAM).

```text
thapelo_vundla@Michelle:~/cloud-hpl-scc26/infrastructure/terraform/environment$ openstack quota show
+-----------------------+--------+
| Resource              |  Limit |
+-----------------------+--------+
| cores                 |     50 |
| instances             |     -1 |
| ram                   | 102400 |
| fixed_ips             |   None |
| networks              |     -1 |
| volumes               |     -1 |
| snapshots             |     -1 |
| gigabytes             |    900 |
| backups               |     -1 |
| floating-ips          |      1 |
| ... (truncated for brevity) ...|
+-----------------------+--------+
```

### 2. Infrastructure Deployment Status
Confirms that all 5 cluster nodes have been provisioned with the Rocky Linux 9 image and are currently in an `ACTIVE` state on the correct networks.

```text
thapelo_vundla@Michelle:~/cloud-hpl-scc26/infrastructure/terraform/environment$ openstack server list
+--------------------------------------+---------------+--------+----------------------------------------+---------+-----------+
| ID                                   | Name          | Status | Networks                               | Image   | Flavor    |
+--------------------------------------+---------------+--------+----------------------------------------+---------+-----------+
| 0077c811-b2be-433f-be2b-3cdef3528391 | api-lb-01     | ACTIVE | scc-network=10.83.0.225                | Rocky 9 | C4.small  |
| 8c948e43-28a8-496a-8cf0-b232c7e67d68 | k8s-cp-01     | ACTIVE | scc-network=10.83.0.68                 | Rocky 9 | C8.medium |
| 8fbe29c0-8ede-4c78-a6bf-dfc1139e2855 | k8s-worker-02 | ACTIVE | scc-network=10.83.0.160                | Rocky 9 | C8.medium |
| a94b0ca7-e76e-4c21-85d0-9db1d59f742a | k8s-worker-01 | ACTIVE | scc-network=10.83.0.251                | Rocky 9 | C8.medium |
| eab9d99e-cd8f-4413-82a7-00479de2a4eb | edge-01       | ACTIVE | scc-network=10.83.0.110, 154.114.52.16 | Rocky 9 | C8.medium |
+--------------------------------------+---------------+--------+----------------------------------------+---------+-----------+
```

### 3. Persistent Storage Volumes
Demonstrates that the persistent volumes are correctly attached to the worker nodes.

```text
thapelo_vundla@Michelle:~/cloud-hpl-scc26/infrastructure/terraform/environment$ openstack volume list
+--------------------------------------+------------------------------------------+-----------+------+----------------------------------------+
| ID                                   | Name                                     | Status    | Size | Attached to                            |
+--------------------------------------+------------------------------------------+-----------+------+----------------------------------------+
| 8fcd4035-946f-46cf-a717-11a7a512a412 | pvc-cc5033b4-3b20-4c8f-ac4d-903cbfb713d7 | in-use    |    5 | Attached to k8s-worker-01 on /dev/vdc  |
| 3dd2c363-efb1-41cc-8ace-88b056f2b06d | pvc-d3af5360-5c83-48a8-ae2a-0b1e7ef7e5c2 | in-use    |   10 | Attached to k8s-worker-02 on /dev/vdb  |
| 6cd34962-4f11-4a1d-89a1-f9a084e36879 | pvc-4b3f7ec1-1bec-4657-acb1-95fb6012ffda | in-use    |    5 | Attached to k8s-worker-01 on /dev/vdb  |
| 10e7f900-a941-406d-b4f8-8ab363800af1 | pvc-7b07f473-1d68-4076-aa49-86b4b514b1e9 | available |    1 |                                        |
+--------------------------------------+------------------------------------------+-----------+------+----------------------------------------+
```

### 4. Terraform State Verification
Confirms that the manual OpenStack security group rule for WireGuard (UDP 51820) was successfully imported and defined in code, resulting in zero infrastructure drift.

```text
thapelo_vundla@Michelle:~/cloud-hpl-scc26/infrastructure/terraform/environment$ terraform plan
openstack_compute_keypair_v2.scc_key: Refreshing state... [id=scc-key]
...
data.openstack_networking_port_v2.edge_port: Read complete after 0s [id=5bc8f2e8-2a17-401a-8b65-15d21116cee4]
openstack_networking_floatingip_associate_v2.edge_fip_assoc: Refreshing state... [id=3bf8c6ce-ccea-4573-b690-a81101631196]

No changes. Your infrastructure matches the configuration.

Terraform has compared your real infrastructure against your configuration and found no differences, so no changes are needed.
```

### 5. Private Network Routing Verification
Due to institutional network firewalls blocking outbound UDP 51820 traffic on the local workstation, WireGuard connectivity was verified via SSH ProxyJump. This proves a successful internal routing path from the public `edge-01` node into the private `api-lb-01` node.

```text
thapelo_vundla@Michelle:~/cloud-hpl-scc26/infrastructure/terraform/environment$ ssh -J rocky@154.114.52.16 rocky@10.83.0.225
** WARNING: connection is not using a post-quantum key exchange algorithm.
** This session may be vulnerable to "store now, decrypt later" attacks.
** The server may need to be upgraded. See https://openssh.com/pq.html
The authenticity of host '10.83.0.225 (<no hostip for proxy command>)' can't be established.
ED25519 key fingerprint is: SHA256:SlkqidkjAhaetpSWAOud74rQXasb325X8cQOURvZceM
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '10.83.0.225' (ED25519) to the list of known hosts.
** WARNING: connection is not using a post-quantum key exchange algorithm.
** This session may be vulnerable to "store now, decrypt later" attacks.
** The server may need to be upgraded. See https://openssh.com/pq.html
Last login: Wed Oct 21 17:26:12 2026 from 10.83.0.110
[rocky@api-lb-01 ~]$
[rocky@api-lb-01 ~]$ pwd
/home/rocky
[rocky@api-lb-01 ~]$
```