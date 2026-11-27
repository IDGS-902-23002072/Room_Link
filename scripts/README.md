# scripts

Scripts de automatización (setup de entorno, labels de GitHub, utilidades de release).

Convención: shell scripts `.sh` para POSIX, `.ps1` para Windows. Documentar en el header cada uno qué hace y qué variables de entorno espera.

## Monitoreo (F2/F3/F5)

Los tres scripts son de una sola ejecución; se encargan de enviar datos a
`roomlink_monitor` mediante el endpoint protegido con token. Ninguno escribe en
la base principal `roomlink`.

Variables comunes:

- `ROOMLINK_BASE_URL` (por defecto `http://127.0.0.1:3000`).
- `MONITOR_INGEST_TOKEN` (obligatorio; el mismo que `MONITOR_INGEST_TOKEN` del backend).
- `MONITOR_INGEST_URL` (opcional; base del endpoint, por ejemplo
  `http://127.0.0.1:3000/api/v1/admin/monitoring/ingest`). Cada script le añade
  `/probe`, `/backup` o `/test-run`. Si se deja vacía, se usa `ROOMLINK_BASE_URL`.

Sondeo de `/ready` cada minuto (cron propio, fuera de GitHub Actions):

```cron
* * * * * cd /ruta/Room_Link && MONITOR_INGEST_TOKEN=... node scripts/probe-ready.mjs >> logs/monitor-probe.log 2>&1
```

Registro de un respaldo diario (llamar al terminar el respaldo):

```bash
BACKUP_DATE=2026-11-27 BACKUP_STATUS=success \
BACKUP_SIZE_BYTES=123456 BACKUP_DURATION_MS=4200 \
MONITOR_INGEST_TOKEN=... node scripts/record-backup.mjs
```

Ingesta de una corrida de Vitest (la corrida se marca completa solo con `--complete`):

```bash
npm --prefix backend run test:unit:json
MONITOR_INGEST_TOKEN=... npm --prefix backend run monitor:ingest -- --suite=backend:unit --complete
```

El reporte JSON se escribe en `reports/` y ese directorio está ignorado por Git.
Si no hay token o el endpoint no responde, el script solo imprime un evento JSON y
termina con éxito: la monitorización nunca rompe una corrida de pruebas.

`.github/workflows/monitoring.yml` programa el sondeo cada 5 minutos (mínimo de
GitHub Actions). Para cumplir los 60 sondeos por hora de T.1 se recomienda el
cron de una VM con `* * * * *`, según el bloque superior.

## Cierre mensual (F7)

Exportar el CSV de un mes (el token se lee solo del entorno; nunca se pasa por
argumentos ni se imprime):

```bash
ROOMLINK_BASE_URL=http://127.0.0.1:3000 \
MONITOR_ADMIN_TOKEN=... \
npm --prefix backend run monitor:export -- --period=2026-10
```

Guarda `reports/solicitudes-YYYY-MM.csv` con BOM y el encabezado esperado por la
retención. `reports/` está ignorado por Git. La descarga HTTP real requiere una sesión
de administrador; para no escribir en `roomlink` no se creó una, por lo que la
verificación queda cubierta por `backend/tests/unit/monitoring-export-script.unit.test.ts`.

Generar el mes simulado de la demo y su foto mensual:

```bash
npm --prefix backend run monitor:seed:demo -- --period=2026-10
npm --prefix backend run monitor:slo -- --period=2026-10
```

Los datos se marcan `synthetic`/`test`: no contaminan las transacciones reales y
T.3 aparece como “sin dato”. La guía completa está en `docs/monitoreo-demo.md`.

Retención de 90 días. Sin `--apply` solo imprime el plan; con `--apply` borra meses
que tengan foto en `mon_slo_compliance`, CSV válido y 90 días cumplidos:

```bash
npm --prefix backend run monitor:retention -- --period=2026-10
npm --prefix backend run monitor:retention -- --apply --csv-dir=../reports
```

Plantilla de entrega mensual y checklist de cierre: `docs/reporte-mensual.md` y
`docs/checklist-monitoreo.md`.

## APK Android automático

`.github/workflows/android-release.yml` se ejecuta con cada push a `main`, incluido
el merge `develop → main`. También permite **Actions → Android APK · compilar y
publicar → Run workflow**, seleccionando `main`. Un PR abierto o un push a
`develop` no publica APK. Para exigir que todas las actualizaciones lleguen por PR,
configurar la protección de `main` en GitHub.

El workflow usa Node 22, Java 21 y Android SDK en Ubuntu 24.04. Instala los dos
lockfiles de frontend, ejecuta las pruebas unitarias y TypeScript, genera Android
con Expo Prebuild y compila `assembleRelease`. No requiere Android Studio local,
cuenta Expo ni token EAS. El proyecto nativo generado no se guarda en Git.

### Configuración inicial

En **Settings → Environments → production → Environment secrets** (o Repository
secrets), configurar:

| Secret | Contenido |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Archivo keystore de la firma actual codificado en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del almacén |
| `ANDROID_KEY_ALIAS` | Alias de la clave que firma el APK |
| `ANDROID_KEY_PASSWORD` | Contraseña de esa clave |
| `AZURE_VM_HOST` | Host de la VM, como en el workflow de API/web |
| `AZURE_VM_USER` | Usuario SSH con escritura en `/opt/roomlink/downloads` |
| `AZURE_VM_SSH_KEY` | Clave SSH de despliegue existente |
| `AZURE_VM_KNOWN_HOSTS` | Claves públicas SSH verificadas del servidor |

No incluir claves ni contraseñas en commits. La firma se decodifica en un archivo
temporal con permisos restrictivos, se pasa a Gradle por variables y se elimina
al terminar. Si falta algún secreto de firma, no se genera ni publica un APK.
Reutilizar la firma del APK ya distribuido para que Android permita actualizarlo;
no crear una clave nueva sin planificar la reinstalación de la app.

`EXPO_PUBLIC_API_URL` se lee de `frontend/Room_Link/.env.production`, debe ser un
origen HTTPS y queda incorporada en la compilación. `ANDROID_VERSION_CODE` se
asigna con la fecha Unix en segundos para que aumente en cada ejecución; comprobar
antes de la primera publicación que supera el versionCode del APK existente.
La configuración rechaza valores fuera del rango de Android.

### Resultado

- Compilación y publicación ocurren en un solo job: el APK no se guarda en GitHub
  (ni artifact ni release) y se borra del runner al terminar. Si Azure falla,
  se vuelve a ejecutar el workflow (`workflow_dispatch`).
- URL permanente: `<EXPO_PUBLIC_API_URL>/descargas/roomlink.apk`.
- Azure debe tener el enlace `current/public/descargas → /opt/roomlink/downloads`
  que configura `deploy-azure-release.sh`.
- La publicación comparte el bloqueo `roomlink-production` con el despliegue de
  API/web. Comprueba SHA-256 antes del reemplazo atómico y verifica por HTTPS el
  APK publicado. Conserva `roomlink.previous.apk` para recuperación manual.
- Si falla la verificación HTTPS, revisar el job antes de promover otra versión;
  el APK anterior permanece respaldado. No se reinicia la API para publicar el APK.

Este workflow no publica en Google Play ni despliega cambios del backend o web.
Debe llegar a `main` junto con el código móvil para activar la primera ejecución.

Validación local de la automatización, sin red ni credenciales:

```bash
bash -n scripts/deploy-android-apk.sh
python3 -B -m unittest discover -s scripts/tests -p 'test_android_deploy.py'
node --test scripts/tests/android-config.test.cjs
```
