# 🚚 Handoff de despliegue — RoomLink en Azure (continuar en otra compu)

> Estado al 2026-11-20. Resume TODO lo que se sabe y lo que falta.
> Complementa a [`DEPLOY.md`](DEPLOY.md) (runbook) — este doc es el estado real + traspaso de máquina.

---

## ✅ Lo que YA está desplegado (en Azure, canadacentral)
El `terraform apply` creó, en el grupo `rg-roomlink-prod`:
- Resource group, VNet, subnet, IP pública estática, NIC.
- **VM `vm-roomlink-prod`** — `Standard_B2pls_v2` (ARM Ampere, 2 vCPU / 4 GiB), Ubuntu 24.04 `server-arm64`. **Creada OK.**
- El NSG `nsg-roomlink-prod` **existe en Azure** pero **NO está en el state de Terraform** (falló con "already exists" / bug transitorio del provider). Hay que **importarlo** (ver abajo).

La VM, al bootear, corre el `custom_data` (cloud-init) que instala: swap 2 GB, Docker, **MySQL 8.4** (contenedor, buffer pool 512M), **Node 22**, **Caddy** (HTTPS automático). Eso tarda unos minutos tras crearse la VM. El código de la app lo sube después el CD (GitHub Actions), no el cloud-init.

- **FQDN (estable):** `roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com`
- **API URL:** `https://roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com`
- La móvil ya apunta ahí (`frontend/Room_Link/.env.production`).

---

## ⬜ Lo que FALTA (en orden)

### 1. Terminar Terraform (importar NSG + crear la asociación)
```bash
cd infra/terraform

terraform import azurerm_network_security_group.vm \
  "/subscriptions/e2641be1-af9a-4d98-a264-208a2adbec72/resourceGroups/rg-roomlink-prod/providers/Microsoft.Network/networkSecurityGroups/nsg-roomlink-prod"

terraform apply -auto-approve   # crea la última pieza: NIC↔NSG association
```
Al terminar, `terraform apply` debe decir "Apply complete" sin errores.

### 2. Confirmar que la VM terminó el cloud-init
```bash
terraform output -raw ssh_private_key > /tmp/roomlink_key && chmod 600 /tmp/roomlink_key
ssh -i /tmp/roomlink_key azureuser@roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com \
  'sudo docker ps; systemctl is-enabled roomlink; ls /opt/roomlink'
# Debe verse el contenedor roomlink-mysql corriendo y el .env en /opt/roomlink.
```

### 3. Cargar GitHub Secrets (para el CD `release.yml`)
```bash
gh secret set AZURE_API_URL    --body "$(terraform -chdir=infra/terraform output -raw api_url)"
gh secret set AZURE_VM_HOST    --body "$(terraform -chdir=infra/terraform output -raw vm_fqdn)"
gh secret set AZURE_VM_USER    --body "azureuser"
gh secret set AZURE_VM_SSH_KEY --body "$(terraform -chdir=infra/terraform output -raw ssh_private_key)"
```

### 4. Disparar el despliegue del código (lo hace el usuario)
`release.yml` corre al pushear un tag:
```bash
git tag v1.0.0 && git push origin v1.0.0
```
El workflow: build web (`expo export` → `backend/public`) → `scp`+`ssh` a la VM → migraciones → health-check.

### 5. Verificar
```bash
curl -sf https://roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com/ready
# espera {"ready":true,...}. Caddy tarda ~1 min la 1ª vez en emitir el cert TLS.
```

---

## 💾 TRASPASO DE MÁQUINA — qué pasar que NO está en git

**Código:** va por git normal. Commiteá y pusheá los cambios (incluyen los fixes HU-07/HU-02/HU-05, `app.ts`, `release.yml`, infra, etc.) **en esta compu antes de irte**; en la otra hacés `git pull`.

**Lo que git IGNORA y hay que pasar aparte (NO subir a git — tiene secretos):**

| Archivo | Por qué | Cómo pasarlo |
|---|---|---|
| **`infra/terraform/terraform.tfstate`** | ⚠️ **Crítico.** Contiene la **clave SSH privada** de la VM, las **contraseñas de MySQL** y los IDs de los recursos. Sin él, la otra compu no puede manejar el despliegue ni entrar a la VM, y Terraform intentaría recrear todo. | USB / canal cifrado. **Nunca a git ni a chat.** |
| `infra/terraform/terraform.tfstate.backup` | Respaldo del state anterior. | Igual que arriba. |
| `frontend/Room_Link/.env.production` | Solo contiene la API URL de Azure (no secreto), pero git lo ignora. | Copiar, o recrear con la URL del FQDN. |

**NO hace falta pasar** `infra/terraform/.terraform/` (270 MB de plugins): se regenera en la otra compu con `terraform -chdir=infra/terraform init`.

### En la otra compu (checklist)
1. Instalar: `terraform`, `az` (Azure CLI), `gh` (GitHub CLI), Node 22 / Bun.
2. `az login` (suscripción Azure for Students `e2641be1-...`) y `gh auth login`.
3. `git clone`/`git pull` el repo.
4. Copiar `terraform.tfstate` (+ `.backup`) a `infra/terraform/` y `.env.production` a `frontend/Room_Link/`.
5. `terraform -chdir=infra/terraform init` (baja los providers).
6. Seguir desde **"Lo que FALTA" paso 1**.

---

## 🧠 Cosas aprendidas (para no retropezar)
- **B1s (VM gratis) NO tiene capacidad** en ninguna región permitida (`SkuNotAvailable`). Está sobre-suscrito. El sondeo `az vm list-skus ... restrictions` da **falsos positivos** — solo el `apply` confirma capacidad.
- **La cuota decide la familia.** Esta suscripción solo tiene cuota v2 en **Bpsv2 (ARM, 0/10)**; AMD (Basv2) e Intel (Bsv2) = 0. Por eso la VM es ARM (`B2pls_v2`). ARM Ampere tiene buena capacidad. Para elegir tamaño: `az vm list-usage --location <región>` y usar una familia con límite >0.
- **Costo:** ~$12.6/mes, cubierto por el **crédito gratis de Azure for Students** (~$100, sin tarjeta) ⇒ $0 de bolsillo.
- **Bug transitorio del NSG:** "Provider produced inconsistent result after apply: Root object was present, but now absent" → reintentar `apply`; si dice "already exists", **importar** el NSG (paso 1) o `az group delete -g rg-roomlink-prod --yes` y reaplicar desde cero.
- **Restricciones del agente:** `terraform apply/plan`, `az group delete` y `git push` están gateados en el entorno del agente → los corre el usuario a mano.
