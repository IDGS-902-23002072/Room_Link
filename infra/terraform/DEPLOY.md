# Despliegue de RoomLink en Azure

GitHub Actions publica la API y Expo Web en la misma URL HTTPS. Caddy reenvía las solicitudes al servicio Node de la VM. MySQL corre en Docker con un volumen persistente.

| Configuración | Valor |
|---|---|
| Grupo de recursos | rg-roomlink-prod |
| Región y VM | canadacentral · vm-roomlink-prod · Standard_B2pls_v2 (ARM64) |
| Origen público | [roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com](https://roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com) |
| Configuración de Expo | [frontend/Room_Link/.env.production](../../frontend/Room_Link/.env.production) |
| Configuración de la API en la VM | /opt/roomlink/.env |
| Automatización | [release.yml](../../.github/workflows/release.yml) |

Consulta el [traspaso](HANDOFF.md) antes de cambiar infraestructura. Para publicar una versión de la app en la VM existente basta con el flujo de este documento.

## Verificar Azure y cloud-init

Con una sesión de Azure CLI en la suscripción del proyecto, consulta el estado de la VM y el NSG asociado a su NIC. Una respuesta vacía para el NSG requiere verificar también la subred y sus reglas efectivas antes de dar la conectividad por lista.

~~~bash
az vm get-instance-view -g rg-roomlink-prod -n vm-roomlink-prod \
  --query 'instanceView.statuses[].code' -o tsv
az network nic show -g rg-roomlink-prod -n nic-roomlink-prod \
  --query 'networkSecurityGroup.id' -o tsv
az network nic list-effective-nsg -g rg-roomlink-prod -n nic-roomlink-prod -o json
az network public-ip show -g rg-roomlink-prod -n pip-roomlink-prod \
  --query '{fqdn:dnsSettings.fqdn,ip:ipAddress}' -o table
~~~

Comprueba que 80 y 443 estén accesibles para el tráfico web, que el origen del despliegue tenga acceso SSH por el puerto 22 y que MySQL escuche solo en la interfaz local. Revisa cloud-init desde un acceso administrativo autorizado. En el primer despliegue, es normal que RoomLink todavía no esté iniciado.

~~~bash
sudo cloud-init status --wait
sudo docker ps --filter name=roomlink-mysql
sudo systemctl is-active caddy
systemctl is-enabled roomlink
test -r /opt/roomlink/.env
node --version
sudo ssh-keygen -l -f /etc/ssh/ssh_host_ed25519_key.pub
~~~

## Configurar GitHub Actions

Usa una clave SSH de despliegue nueva. Instala su clave pública para azureuser y prueba el acceso antes de retirar la clave anterior. Guarda el registro known_hosts con el FQDN y la clave pública del **servidor**, obtenida por un canal administrativo de Azure. Verifica su huella con el comando anterior. Los estados adjuntos contenían la clave privada anterior y contraseñas de MySQL. Rota esas credenciales, actualiza la configuración de la VM y resguarda el estado por un canal cifrado.

Ejecuta estos comandos desde la raíz del repositorio con una cuenta GitHub autorizada. Las rutas apuntan a los archivos que se deben preparar en la máquina administradora.

~~~bash
gh secret set AZURE_VM_HOST --body 'roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com'
gh secret set AZURE_VM_USER --body 'azureuser'
gh secret set AZURE_VM_SSH_KEY < "$HOME/.ssh/roomlink_deploy"
gh secret set AZURE_VM_KNOWN_HOSTS < "$HOME/.ssh/roomlink_known_hosts"
~~~

El workflow lee la URL pública de .env.production. El .env local de desarrollo puede seguir apuntando a http://localhost:3000. Si el equipo usa EAS para publicar binarios nativos, configura EXPO_PUBLIC_API_URL en el entorno production del proyecto Expo. Esta automatización publica Expo Web.

## Publicar y verificar

Integra los cambios en la rama de release. Desde GitHub Actions, ejecuta **Release & Deploy (Azure)** sobre la rama que contiene el workflow actualizado o publica un nuevo tag v*.*.* en el commit aprobado.

El script instala las dependencias de producción en la VM ARM64, aplica migraciones antes de reemplazar la versión activa y conserva las fotos en /opt/roomlink/uploads. Si la nueva versión falla al reiniciar o al responder en /ready local, intenta restaurar la versión anterior. La restauración del código conserva las migraciones ya aplicadas. Toma un respaldo de MySQL antes de una migración incompatible.

~~~bash
base=https://roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com
curl -fsS "$base/health"
curl -fsS "$base/ready"
curl -fsS "$base/" -o /dev/null
~~~

/health debe devolver status igual a ok. /ready debe devolver status igual a ready y database igual a connected. La raíz debe servir Expo Web. Si el HTTPS devuelve 502, comprueba por separado systemctl status roomlink, curl http://127.0.0.1:3000/ready y sudo journalctl -u caddy -n 50.

Si el servidor tiene fotos en varios directorios históricos, consolídalas conservando sus rutas relativas antes de publicar otra versión.
