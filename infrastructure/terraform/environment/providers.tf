terraform {
  required_version = ">= 1.3.0"
  required_providers {
    openstack = {
      source  = "terraform-provider-openstack/openstack"
      version = "3.4.0"
    }
  }
}

provider "openstack" {
  # Leave empty to dynamically use the openrc.sh environment variables
}