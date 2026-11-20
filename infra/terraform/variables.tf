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
  description = "Tamaño de la VM. B2pls_v2 = ARM Ampere, 2 vCPU / 4 GiB, familia Bpsv2 (única v2 con cuota en esta suscripción) y con capacidad. ~$12.6/mes (cubierto por el crédito gratis de estudiante). B1s (gratis) no tiene capacidad."
  type        = string
  default     = "Standard_B2pls_v2"
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
