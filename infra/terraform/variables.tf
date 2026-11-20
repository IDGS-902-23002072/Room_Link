variable "subscription_id" {
  description = "Azure Subscription ID (Azure for Students)"
  type        = string
  default     = "e2641be1-af9a-4d98-a264-208a2adbec72"
}

variable "location" {
  description = "Región permitida por Azure for Students con cuota y capacidad Standard_B1s (canadacentral: B1s sin restricción, BS 0/4, verificado 2026-11-20)"
  type        = string
  default     = "canadacentral"
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
