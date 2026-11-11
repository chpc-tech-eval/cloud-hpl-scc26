# 1. Create a private network for the cluster
resource "openstack_networking_network_v2" "scc_network" {
  name           = "scc-network"
  admin_state_up = true
}

# 2. Create a subnet inside that network 
resource "openstack_networking_subnet_v2" "scc_subnet" {
  name       = "scc-subnet"
  network_id = openstack_networking_network_v2.scc_network.id
  cidr       = var.subnet_cidr
  ip_version = 4
}

# Create Worker Node 1
resource "openstack_compute_instance_v2" "k8s_worker_01" {
  name            = "k8s-worker-01"
  image_id        = var.image_id
  flavor_id       = var.flavor_worker
  security_groups = ["default"]
  key_pair        = openstack_compute_keypair_v2.scc_key.name

  # Tell Terraform to wait for the subnet to exist before booting
  depends_on = [openstack_networking_subnet_v2.scc_subnet]

  network {
    uuid = openstack_networking_network_v2.scc_network.id
  }
}

# Create Worker Node 2
resource "openstack_compute_instance_v2" "k8s_worker_02" {
  name            = "k8s-worker-02"
  image_id        = var.image_id
  flavor_id       = var.flavor_worker
  security_groups = ["default"]
  key_pair        = openstack_compute_keypair_v2.scc_key.name

  # Tell Terraform to wait for the subnet to exist before booting
  depends_on = [openstack_networking_subnet_v2.scc_subnet]

  network {
    uuid = openstack_networking_network_v2.scc_network.id
  }
}

# Create edge-01
resource "openstack_compute_instance_v2" "edge_01" {
  name            = "edge-01"
  image_id        = var.image_id
  flavor_id       = var.flavor_medium
  security_groups = ["default", openstack_networking_secgroup_v2.edge_secgroup.name]
  key_pair        = openstack_compute_keypair_v2.scc_key.name

  # Tell Terraform to wait for the subnet to exist before booting
  depends_on = [openstack_networking_subnet_v2.scc_subnet]

  network {
    uuid = openstack_networking_network_v2.scc_network.id
  }
}

# Create api-lb-01
resource "openstack_compute_instance_v2" "api_lb_01" {
  name            = "api-lb-01"
  image_id        = var.image_id
  flavor_id       = var.flavor_small
  security_groups = ["default"]
  key_pair        = openstack_compute_keypair_v2.scc_key.name

  # Tell Terraform to wait for the subnet to exist before booting
  depends_on = [openstack_networking_subnet_v2.scc_subnet]

  network {
    uuid = openstack_networking_network_v2.scc_network.id
  }
}

# Create k8s-cp-01
resource "openstack_compute_instance_v2" "k8s_cp_01" {
  name            = "k8s-cp-01"
  image_id        = var.image_id
  flavor_id       = var.flavor_medium
  security_groups = ["default"]
  key_pair        = openstack_compute_keypair_v2.scc_key.name

  # Tell Terraform to wait for the subnet to exist before booting
  depends_on = [openstack_networking_subnet_v2.scc_subnet]

  network {
    uuid = openstack_networking_network_v2.scc_network.id
  }
}

# Upload the SSH Keypair
resource "openstack_compute_keypair_v2" "scc_key" {
  name       = "scc-key"
  public_key = file("~/.ssh/scc_key.pub")
}

# Create a router pointing to the external network
resource "openstack_networking_router_v2" "scc_router" {
  name                = "scc-router"
  admin_state_up      = true
  external_network_id = var.external_network_id
}

# Plug the private subnet into the router
resource "openstack_networking_router_interface_v2" "scc_router_interface" {
  router_id = openstack_networking_router_v2.scc_router.id
  subnet_id = openstack_networking_subnet_v2.scc_subnet.id
}

# Request a public IP from the external network
resource "openstack_networking_floatingip_v2" "edge_fip" {
  pool = "Public Internet"
}

# Find the network port attached to edge-01
data "openstack_networking_port_v2" "edge_port" {
  device_id = openstack_compute_instance_v2.edge_01.id
}

# Associate the floating IP to the edge port
resource "openstack_networking_floatingip_associate_v2" "edge_fip_assoc" {
  floating_ip = openstack_networking_floatingip_v2.edge_fip.address
  port_id     = data.openstack_networking_port_v2.edge_port.id
}

resource "openstack_networking_secgroup_v2" "edge_secgroup" {
  name        = "edge-ssh-access"
  description = "Allow inbound SSH traffic"
}

resource "openstack_networking_secgroup_rule_v2" "allow_ssh" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.edge_secgroup.id
}