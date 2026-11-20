# Runbook de despliegue — RoomLink en Azure (capa gratuita)

> **Todo lo de código/config ya está hecho.** Faltan solo los comandos que
> aprovisionan la nube (requieren tu cuenta Azure/GitHub y confirmación).
> Este entorno de agente tiene gateado `terraform apply` y `az group delete`,
> por eso los corrés vos.

## Qué quedó configurado
- **Región**: `canadacentral`. **VM**: `Standard_B2pls_v2` (ARM Ampere, 2 vCPU / 4 GiB).
  - **Por qué no B1s (gratis):** B1s no tiene **capacidad** en ninguna región permitida
    (northcentralus y canadacentral fallaron con `SkuNotAvailable`). Es lo típico del
    tamaño gratis: sobre-suscrito.
  - **Por qué ARM:** la suscripción solo tiene **cuota** para `Bpsv2` (ARM, 0/10) entre las
    familias v2; `Basv2` (AMD) y `Bsv2` (Intel) tienen cuota 0. ARM Ampere además tiene
    buena capacidad. Imagen Ubuntu 24.04 `server-arm64`. MySQL/Node/Caddy corren en ARM.
  - **Costo:** ~$12.6/mes, cubierto por el crédito gratis de Azure for Students (~$100,
    sin tarjeta) ⇒ **$0 de tu bolsillo**. Para cambiar tamaño/región: vars `vm_size`,
    `vm_image_sku`, `location`.
- **Infra 100% free-tier** (`main.tf`): 1 VM `Standard_B1s` (750 h/mes gratis 12 meses),
  IP pública estática Standard, disco 30 GB Standard_LRS, VNet/subnet/NSG. Sin App Service
  ni Azure MySQL Flexible (esos no están en la capa gratis de Students).
- **MySQL 8.4 + Node 22 + Caddy** se instalan por `custom_data` (cloud-init) en la VM.
  Caddy saca HTTPS real (Let's Encrypt) para el FQDN gratuito de Azure.
- **FQDN estable**: `roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com`
  (depende de `random_string.suffix=xdg80v`, ya fijo en el state; no cambia al recrear).
- **Móvil**: `frontend/Room_Link/.env.production` → `EXPO_PUBLIC_API_URL=https://<fqdn>`.
  Dev local sigue en `.env` (`localhost:3000`).
- **Backend CORS**: lee `FRONTEND_ORIGIN` (cloud-init lo setea a `https://<fqdn>`).

## Estado previo a limpiar
En el state quedó red creada en **northcentralus** (sin VM) y un **NSG huérfano**
(`nsg-roomlink-prod` en northcentralus, fuera del state). Al cambiar la región,
Terraform recrea el RG; borrar el RG arrastra el NSG huérfano.

## Pasos (corrélos vos, en `infra/terraform/`)

```bash
cd infra/terraform

# 1. Ver el plan (ya con location=canadacentral). Confirmá que destruye lo de
#    northcentralus y crea RG+red+NSG+VM en canadacentral, todo tier=free.
terraform plan

# 2. Aplicar (crea la VM B1s + cloud-init instala MySQL/Node/Caddy).
terraform apply -auto-approve

# 3. Leer las salidas que alimentan los GitHub Secrets:
terraform output api_url          # https://roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com
terraform output vm_fqdn          # host para SSH
terraform output -raw ssh_private_key > /tmp/roomlink_deploy_key   # clave SSH del CD
```

> Si el `plan` se queja de que el NSG "ya existe", borrá el RG viejo primero:
> `az group delete -g rg-roomlink-prod --yes` (borra solo la red vacía de
> northcentralus + el NSG huérfano; no hay nada valioso ahí) y repetí el `apply`.

## GitHub Secrets para el CD (`release.yml`)

```bash
gh secret set AZURE_API_URL    --body "$(terraform output -raw api_url)"
gh secret set AZURE_VM_HOST    --body "$(terraform output -raw vm_fqdn)"
gh secret set AZURE_VM_USER    --body "azureuser"
gh secret set AZURE_VM_SSH_KEY --body "$(terraform output -raw ssh_private_key)"
```

## Disparar el despliegue
`release.yml` corre al pushear un tag. **El push lo hacés vos** (el agente no commitea/pushea):

```bash
git tag v1.0.0 && git push origin v1.0.0
```

El workflow: build web (`expo export` → `backend/public`, same-origin) → `scp`+`ssh`
a la VM → migraciones → health-check `GET /ready`.

## Verificación final
```bash
curl -sf https://roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com/ready
# espera: {"ready":true,...}
```
La primera vez, Caddy tarda ~1 min en emitir el certificado; si da error TLS, reintentá.
