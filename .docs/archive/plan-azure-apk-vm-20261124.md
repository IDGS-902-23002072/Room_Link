# Plan activo — Front web en Azure, APK local y VM gratuita

## [OBJETIVO ACTUAL]
Que la VM de Azure sirva la API + el sitio web `web/` (Vite), no la exportación web de la app móvil Expo; que el APK se compile en local y se descargue desde la VM sin pasar nunca por GitHub; y bajar la VM a `Standard_B2pts_v2` (free tier de estudiantes).

## [ARQUITECTURA/DISEÑO]
- **Servido de la web.** Opción A: el backend Hono sigue sirviendo `./public`, ahora con el build de `web/`. Opción B: Caddy sirve los estáticos y hace proxy de `/api`. Se elige A porque reutiliza la estructura existente (un proceso, el script de deploy ya valida `public/index.html`) y no exige tocar el Caddyfile, que solo vive en cloud-init. Se quita el handler `*.html` específico de Expo y queda el fallback SPA para `BrowserRouter`.
- **URL de la API en la web.** `VITE_API_URL` se inyecta en el build desde el mismo origen HTTPS que ya lee el workflow (mismo origen → sin CORS extra).
- **Descarga del APK.** Opción A: ruta nueva en el backend. Opción B: carpeta persistente `/opt/roomlink/downloads` enlazada como `public/descargas`, igual que `uploads`. Se elige B: mismo patrón que `uploads`, sin código nuevo en el backend, y el APK sobrevive a cada release.
- **APK.** `expo prebuild` + `gradlew assembleRelease` en la PC (JDK de Android Studio). `*.apk` y `android/` ya están ignorados por git. Se sube por `scp` con la clave de deploy local.
- **VM.** Resize in-place dentro de la familia Bpsv2 (hay cuota). Con 1 GB de RAM se baja `innodb_buffer_pool_size` a 128 MB con `SET PERSIST` (dinámico, sin recrear el contenedor). Swap de 2 GB ya existe.
- **Sin commits.** Como no se puede pushear, el release se aplica con el mismo `scripts/deploy-azure-release.sh` desde la PC.

## [PASOS DE IMPLEMENTACIÓN (Checklist)]
- [x] Workflow: compilar `web/` con `VITE_API_URL` en lugar de Expo Web.
- [x] Backend: quitar el rewrite `*.html` de Expo y dejar el fallback SPA.
- [x] Deploy script: enlazar `/opt/roomlink/downloads` como `public/descargas`.
- [x] Terraform: `vm_size` por defecto `Standard_B2pts_v2` y descripción corregida.
- [x] Tests: typecheck + unitarios del backend, lint + build de `web/`, `bash -n` del script.
- [x] Compilar el APK de release en local y comprobar la URL de la API embebida.
- [x] Bajar el buffer pool de MySQL y redimensionar la VM; verificar `/health` y `/ready`.
- [x] Desplegar el release desde la PC y subir el APK; verificar web, API y descarga.

## [CRITERIOS DE ACEPTACIÓN]
- `GET /` en producción devuelve el `index.html` de `web/` (Vite), no el de Expo.
- `/health` = ok y `/ready` = ready/connected después del resize.
- `GET /descargas/roomlink.apk` devuelve el APK (200, tamaño > 0).
- `az vm show` reporta `Standard_B2pts_v2`.
- Ningún `.apk` ni build en el índice de git (`git status` limpio de compilados).
