resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "random_password" "mysql_root" {
  length  = 24
  special = false
}

resource "random_password" "mysql_app" {
  length  = 24
  special = false
}

resource "tls_private_key" "deploy" {
  algorithm = "ED25519"
}

locals {
  dns_label = "${var.project}-${var.environment}-${random_string.suffix.result}"
  fqdn      = "${local.dns_label}.${var.location}.cloudapp.azure.com"
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${var.project}-${var.environment}"
  location = var.location

  tags = {
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
    tier        = "free"
  }
}

resource "azurerm_virtual_network" "main" {
  name                = "vnet-${var.project}-${var.environment}"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_subnet" "main" {
  name                 = "snet-app"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_public_ip" "vm" {
  name                = "pip-${var.project}-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = local.dns_label
}

resource "azurerm_network_security_group" "vm" {
  name                = "nsg-${var.project}-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "AllowSSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowHTTP"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface" "vm" {
  name                = "nic-${var.project}-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.main.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.vm.id
  }
}

resource "azurerm_network_interface_security_group_association" "vm" {
  network_interface_id      = azurerm_network_interface.vm.id
  network_security_group_id = azurerm_network_security_group.vm.id
}

# ============================================================================
# Azure Linux VM Standard_B1s (750h/mes GRATIS 12 meses en Azure for Students)
# Ejecuta MySQL 8.4 (Docker) + Node 22 (RoomLink API + Expo Web) + Caddy HTTPS
# ============================================================================
resource "azurerm_linux_virtual_machine" "app" {
  name                = "vm-${var.project}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  size                = var.vm_size
  admin_username      = var.admin_username
  network_interface_ids = [
    azurerm_network_interface.vm.id,
  ]

  admin_ssh_key {
    username   = var.admin_username
    public_key = tls_private_key.deploy.public_key_openssh
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 30
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = var.vm_image_sku
    version   = "latest"
  }

  custom_data = base64encode(<<-EOF
    #!/bin/bash
    set -euo pipefail

    # Swap 2GB para estabilidad en Standard_B1s (1 GB RAM)
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab

    # Instalar Docker, Caddy, Node 22
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https

    # Node.js 22 LTS
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs docker.io

    # Caddy (HTTPS automático con Let's Encrypt)
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy

    systemctl enable --now docker

    # Levantar MySQL 8.4 persistente (enlazado solo a 127.0.0.1)
    docker volume create roomlink_mysql_data
    docker run -d --name roomlink-mysql --restart unless-stopped \
      -p 127.0.0.1:3306:3306 \
      -e MYSQL_ROOT_PASSWORD='${random_password.mysql_root.result}' \
      -e MYSQL_DATABASE='${var.mysql_database_name}' \
      -e MYSQL_USER='${var.mysql_user}' \
      -e MYSQL_PASSWORD='${random_password.mysql_app.result}' \
      -v roomlink_mysql_data:/var/lib/mysql \
      mysql:8.4 --innodb-buffer-pool-size=512M

    # Directorio de la app y .env de producción
    mkdir -p /opt/roomlink
    chown -R ${var.admin_username}:${var.admin_username} /opt/roomlink

    cat > /opt/roomlink/.env <<ENVFILE
    NODE_ENV=production
    PORT=3000
    DB_HOST=127.0.0.1
    DB_PORT=3306
    DB_USER=${var.mysql_user}
    DB_PASSWORD=${random_password.mysql_app.result}
    DB_NAME=${var.mysql_database_name}
    DB_SSL=false
    COOKIE_SECURE=true
    FRONTEND_ORIGIN=https://${local.fqdn}
    ENVFILE
    chown ${var.admin_username}:${var.admin_username} /opt/roomlink/.env
    chmod 600 /opt/roomlink/.env

    # Servicio systemd para RoomLink API + Expo Web
    cat > /etc/systemd/system/roomlink.service <<SERVICE
    [Unit]
    Description=RoomLink Backend API + Web
    After=network.target docker.service

    [Service]
    Type=simple
    User=${var.admin_username}
    WorkingDirectory=/opt/roomlink/current
    EnvironmentFile=/opt/roomlink/.env
    ExecStart=/usr/bin/node dist/src/server.js
    Restart=always
    RestartSec=3

    [Install]
    WantedBy=multi-user.target
    SERVICE

    # Permitir a azureuser reiniciar el servicio sin contraseña en CD
    echo '${var.admin_username} ALL=(ALL) NOPASSWD: /bin/systemctl restart roomlink, /bin/systemctl status roomlink' > /etc/sudoers.d/roomlink-deploy
    chmod 440 /etc/sudoers.d/roomlink-deploy

    systemctl daemon-reload
    systemctl enable roomlink

    # Caddyfile con HTTPS automático
    cat > /etc/caddy/Caddyfile <<CADDY
    ${local.fqdn} {
      reverse_proxy 127.0.0.1:3000
    }
    CADDY
    systemctl reload caddy || systemctl restart caddy
  EOF
  )

  tags = {
    project     = var.project
    environment = var.environment
    tier        = "free"
  }
}
