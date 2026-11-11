variable "external_network_id" {
  description = "The ID of the external provider network"
  type        = string
}

variable "image_id" {
  description = "The ID of the OS image to use (Rocky 9)"
  type        = string
}

variable "flavor_worker" {
  description = "The ID of the flavor for the worker nodes (scc.large)"
  type        = string
}

variable "flavor_medium" {
  description = "ID of the medium flavor (for edge and control plane)"
  type        = string
}

variable "flavor_small" {
  description = "ID of the small flavor (for the API load balancer)"
  type        = string
}

variable "subnet_cidr" {
  type        = string
  description = "The private network CIDR for the cluster"
}