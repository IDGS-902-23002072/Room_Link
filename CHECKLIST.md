# ✅ CHECKLIST — Estado de RoomLink

> Actualizado 2026-11-20 (tarde). App móvil unificada en `frontend/Room_Link`. Backend en `develop`.
> Leyenda: ✅ hecho · ⬜ falta · ⚠️ problema/decisión · ➖ descartado a propósito.
> Verificado contra `develop` tras integrar Guzman (M06/M08 conectados), Roberto (M15 + perfil/búsqueda) y Avril (estados/borradores).

---

## 1. Backend (`develop`)
- ✅ 14 módulos (auth, profile, rooms+feed, applications, compatibility, messaging, moderation, connections, notifications, sanctions, agreements, search, analytics, activity-log).
- ✅ Gate de calidad verificado hoy: **typecheck 0** · **unit+smoke 173/173**. (Integración MySQL requiere la DB levantada: re-correr `npm run test:integration`.)
- ✅ Registro exhaustivo de arrendador (`POST /auth/become-host`, valida identidad + términos).
- ✅ **#8** — bloquea postularse a tu propia publicación.
- ✅ **HU-07** — el **% de afinidad lo calcula el servidor** (antes se guardaba el valor que mandaba el cliente → manipulable). Inyectado en `ApplicationsController` vía compatibilidad.
- ✅ **HU-02** — **no se filtran teléfono/redes**: `ProfileView.toPublicProfile` oculta contacto salvo al dueño o a conexiones aceptadas autorizadas; búsqueda/descubrimiento los oculta siempre. Cubierto por `tests/unit/profile-visibility.unit.test.ts` (6 casos).
- ⬜ **Google OAuth real** (hoy stub) — RNF-04.3 / HU-01. Necesita credenciales.
- ⬜ **SMTP real** (hoy stub) — correo de recuperación con enlace que precargue el token (HU-01). Necesita credenciales.
- ⬜ **HU-07 (resto)** — lista de espera y notificar al postulante cada decisión.
- ⬜ **HU-06 (API)** — validar reglas/servicios/depósito **antes de publicar** (hoy la API deja activar sin completarlos).

## 2. Frontend móvil — `frontend/Room_Link`
Pantallas por módulo (M01–M15):
- ✅ M01 Auth · M02 Perfil · M03 Onboarding convivencia · M04 Exploración · M05 Búsqueda roomies · M06 Compatibilidad detallada (Guzman) · M07 Mis publicaciones (Avril) · M08 Reglas/costos/zona (Guzman) · **M09 Postulaciones del arrendador (verificado E2E)** · M10 Chat · M11 Conexiones · M12 Acuerdos · M13/M14 Moderación · **M15 Dashboard admin (Roberto — `modulos/analytics`)**.
- ✅ **Registro exhaustivo de arrendador** (gate rol host + pantalla "Conviértete en arrendador").
- ✅ **Onboarding obligatorio** (#0/#12): perfil → encuesta antes de usar la app. (Commiteado.)
- ✅ **HU-05 (parcial)** — "Restablecer filtros" ahora borra también los hábitos.
- ⬜ **HU-05 (núcleo)** — Buscar roomies filtra **client-side** sobre una página del feed. El backend YA tiene `search` server-side con `total`; falta **rewirear la pantalla** a `/api/v1/search/profiles` (y, si se quiere filtrar hábitos en servidor, extender `SearchFilters`). No verificable sin dispositivo.
- ⬜ **HU-01 (UI)** — Google sign-in en Expo (la API ya verifica token Google si está configurada); mostrar error de correo/contraseña junto al campo.
- ⬜ **HU-02 (UI)** — controles de privacidad en la pantalla de perfil (el backend ya los respeta).
- ⬜ **HU-04** — usar `hasTest` para invitar a la encuesta; capturar zona/presupuesto del candidato.
- ⬜ **HU-06 (flujo)** — integrar reglas/costos **dentro del flujo de publicar** (hoy en la pantalla de detalle).
- ⬜ **HU-08** — mensaje libre/opcional en la solicitud (hoy manda saludo fijo); notificar al recibir y al rechazar.

## 3. Bugs QA (0–12)
- ✅ **#0/#12** onboarding · **#8** auto-postulación · **#2/#3/#4/#6/#7** publicar/editar/fecha/ubicación (Avril).
- ⬜ **#1** permiso de notificaciones no se guarda → verificar tras cambios de Avril.
- ⬜ **#5.1** indicar "mínimo 3 fotos" en Fotos del espacio.
- ⬜ **#10** Descubrir 500 con cuenta de postulante → re-verificar (pruebas recientes dieron 200).
- ➖ **#9** (guardar perfiles) y **#11** (abrir chat por ID) — se quedan (decisión de producto).

## 4. Equipo / ramas (todo integrado en `develop`)
- ✅ **Roberto** — perfil extendido, búsqueda (M05), acuerdos, verificación, **M15 dashboard admin**.
- ✅ **Avril** — estados de publicación + borradores + fixes del form.
- ✅ **Guzman** — backend conectado con sus pantallas (M06/M08), ya integrado (no es app separada con mocks).

## 5. Despliegue (Azure, capa gratuita)
- ✅ Terraform 100% free-tier (`infra/terraform/`): VM `Standard_B1s` + MySQL/Node/Caddy por cloud-init, HTTPS con el DNS gratuito de Azure. Región **canadacentral** (B1s con capacidad verificada).
- ✅ Móvil configurada: `frontend/Room_Link/.env.production` → FQDN de Azure. CORS lee `FRONTEND_ORIGIN`.
- ⬜ **Correr la provisión** (lo hace el usuario; `terraform apply`/git están gateados para el agente): ver [`infra/terraform/DEPLOY.md`](infra/terraform/DEPLOY.md).
- ⬜ GitHub Secrets + push de tag para disparar `release.yml`.

## 6. Transversal / cierre
- ⬜ OAuth + SMTP reales · Integration tests por módulo · Branch protection · Release `develop → main`.

---

### Resumen
**Verificado y en `develop`:** los 15 módulos + onboarding + registro de arrendador + HU-07 (score server-side) + HU-02 (sin fuga de contacto) + HU-05 parcial. Despliegue Azure listo para provisionar.
**Para "versión completa" faltan, por orden de valor:** rewire de Buscar roomies al search server-side (HU-05), flujo de publicar con reglas/costos (HU-06), notificaciones de postulación/conexión (HU-07/HU-08), y credenciales reales (Google + SMTP, HU-01).
