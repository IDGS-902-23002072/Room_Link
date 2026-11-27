# scripts

Scripts de automatización (setup de entorno, labels de GitHub, utilidades de release).

Convención: shell scripts `.sh` para POSIX, `.ps1` para Windows. Documentar en el header cada uno qué hace y qué variables de entorno espera.

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
