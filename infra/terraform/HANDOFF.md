# Traspaso de despliegue de RoomLink

## Evidencia disponible

| Evidencia | Qué confirma |
|---|---|
| Estado serial 38 | Registró la VM Standard_B2pls_v2 en canadacentral, junto con la VNet, subred, NIC, IP pública y grupo de recursos. |
| Respaldo serial 35 | Misma línea de estado, con la red y la URL pública, anterior al registro de la VM. |
| NSG y asociación a la NIC | El código Terraform los declara. Los dos estados adjuntos carecen de ambos recursos. Su existencia y asociación efectivas en Azure quedan por verificar. |

Los archivos de estado describen lo que Terraform registró al guardarlos. Verifica la VM, las reglas efectivas y el DNS en Azure antes del primer release. La VM del estado es ARM64. Consulta el consumo real en Azure Cost Management.

## Continuar en otra máquina

1. Obtén el código del repositorio y aplica los cambios del workflow antes de publicar un tag.
2. Confirma el estado actual de Azure con las consultas de [DEPLOY.md](DEPLOY.md). Conserva el respaldo como referencia histórica.
3. Verifica cloud-init y rota la clave SSH y las contraseñas MySQL expuestas en las copias adjuntas. Configura los secretos de GitHub con la clave nueva y la identidad comprobada del servidor.
4. Ejecuta el workflow y verifica /health, /ready y la portada web.

La URL pública de Expo se versiona en frontend/Room_Link/.env.production. Los estados y las credenciales se transfieren exclusivamente por un canal cifrado. Si el estado vigente ya registra el NSG y su asociación, usa esa copia para futuras tareas de infraestructura.
