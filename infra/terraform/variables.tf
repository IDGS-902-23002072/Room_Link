variable "subscription_id" {
  description = "Azure Subscription ID (Azure for Students)"
  type        = string
  default     = "e2641be1-af9a-4d98-a264-208a2adbec72"
}

variable "location" {
  description = "Región permitida por Azure for Students. canadacentral: cuota Bpsv2 (ARM) 0/10, con capacidad. B1s/BS v1 no tienen capacidad; Basv2/Bsv2 no tienen cuota (verificado 2026-11-20)."
  type        = string
  default     = "canadacentral"
}

variable "vm_size" {
  description = "Tamaño de la VM. B2pts_v2 = ARM Ampere, 2 vCPU / 1 GiB, familia Bpsv2, incluida en las 750 h/mes gratis de Azure for Students. Con 1 GiB, MySQL usa innodb_buffer_pool_size=128M (SET PERSIST) y la VM tiene 2 GiB de swap. B2pls_v2 (4 GiB) no es gratis."
  type        = string
  default     = "Standard_B2pts_v2"
}

variable "vm_image_sku" {
  description = "SKU de la imagen Ubuntu 24.04. 'server-arm64' para VMs ARM (Bpsv2); 'server' para x86."
  type        = string
  default     = "server-arm64"
}

variable "project" {
  description = "Prefijo del proyecto"
  type        = string
  default     = "roomlink"
}

variable "environment" {
  description = "Entorno de despliegue"
  type        = string
  default     = "prod"
}

variable "admin_username" {
  description = "Usuario SSH de la VM Ubuntu"
  type        = string
  default     = "azureuser"
}

variable "mysql_database_name" {
  description = "Nombre de la base de datos MySQL"
  type        = string
  default     = "roomlink"
}

variable "mysql_user" {
  description = "Usuario de aplicación MySQL"
  type        = string
  default     = "roomlink_app"
}
