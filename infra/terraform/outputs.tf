output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "vm_public_ip" {
  value = azurerm_public_ip.vm.ip_address
}

output "vm_fqdn" {
  value = local.fqdn
}

output "api_url" {
  value = "https://${local.fqdn}"
}

output "ssh_user" {
  value = var.admin_username
}

output "ssh_private_key" {
  value     = tls_private_key.deploy.private_key_openssh
  sensitive = true
}
