# Plan — Unificación del frontend y módulos restantes

Documento de handoff para retomar el trabajo desde otra computadora.
Última actualización: 2026-11-18.

---

## 0. ⚠️ ANTES DE CAMBIAR DE COMPUTADORA (crítico)

El trabajo de la **Fase 1** está en el árbol de trabajo **sin commitear**. Si no
lo pusheás, la otra compu no lo tiene. Hacé:

```bash
git status                     # confirmá los cambios
git add -A
git commit -m "feat(frontend): unificar en Room_Link — auth de sesión + rewire de api.ts a Bearer (Fase 1)"
git push origin develop
```

Cambios sin commitear ahora mismo (rama `develop`):
- `frontend/Room_Link/src/auth/` — **nuevo** (sesion, api-auth, SesionContext, ui)
- `frontend/Room_Link/src/app/(auth)/` — **nuevo** (login, registro, recuperar, _layout)
- `frontend/Room_Link/src/app/_layout.tsx` — gating por sesión
- `frontend/Room_Link/src/modulos/{compatibilidad,anuncios,perfil,perfil/galeria,encuesta}` — rewire de API a sesión
- `frontend/Room_Link/src/modulos/anuncios/PantallaUbicacion.web.tsx` — **nuevo** (shim web de mapas)
- `frontend/Room_Link/package-lock.json`

> El `.env` de `frontend/Room_Link` (`EXPO_PUBLIC_API_URL=http://localhost:3000`)
> está gitignoreado — recrealo en la otra compu (ver §2).

Lo demás (CORS `credentials:true`, E2E puppeteer, workflows CI, `docs/testing.md`)
**ya está en `origin/develop`**.

---

## 1. Dónde estamos

- **Backend: 100%** — 14 módulos, verificado (typecheck 0, unit 154/154, smoke 12/12,
  integración MySQL 4/4). Publicado en `origin/develop`.
- **Frontend: en unificación.** Había **dos apps**:
  - `frontend/` (César): auth, mensajería, moderación — React Native Web.
  - `frontend/Room_Link/` (Omar + Avril): exploración, anuncios, perfil, encuesta,
    maps — Expo Router, nativa.
- **Decisión tomada:** base = **`frontend/Room_Link`** (Expo Router, nativa, más
  módulos, los 4 tabs) y se porta lo de César encima. `frontend/` (César) queda
  como fuente para portar, después se elimina.

---

## 2. Cómo retomar desde casa (setup)

```bash
# 1. Traer el repo
git pull origin develop

# 2. MySQL (el backend lo necesita en 3307)
cd backend && docker compose up -d        # expone MySQL 8.4 en :3307
DB_PORT=3307 npm run db:migrate

# 3. Backend real en :3000
DB_PORT=3307 npm run start:node           # health: curl localhost:3000/ready

# 4. Frontend Room_Link
cd ../frontend/Room_Link
printf 'EXPO_PUBLIC_API_URL=http://localhost:3000\n' > .env   # base = ORIGEN (sin /api/v1)
npm install
npx expo start                            # nativo (emulador)  —  ó  expo export --platform web para web
```

### Probar auth (navegador, como el E2E)
```bash
cd frontend/Room_Link
npx expo export --platform web
(cd dist && python3 -m http.server 8081)  # 8081 está permitido por el CORS del backend
# abrir http://localhost:8081 → debe redirigir a login → registrar/entrar → tabs
```

---

## 3. ✅ HECHO — Fase 1: Auth + rewire completo (base Room_Link)

Verificado end-to-end (login real contra backend+MySQL, 0 errores de consola).

- **Capa de sesión** (`src/auth/sesion.ts`): token+usuario en memoria + AsyncStorage + suscripción.
- **Funciones auth** (`src/auth/api-auth.ts`): register/login/recuperar/reset/logout.
- **Contexto** (`src/auth/SesionContext.tsx`) + **gating** en `app/_layout.tsx` (sin sesión → login).
- **Pantallas** `app/(auth)/`: login, registro, recuperar (+ `src/auth/ui.tsx`, paleta de marca).
- **Rewire de TODAS las api.ts** a la sesión real (Bearer + userId de la sesión), eliminando
  el hack `EXPO_PUBLIC_USER_ID`. Helper central: `modulos/compatibilidad/api.ts`.
- **Bugs pre-existentes resueltos:** (a) `EXPO_PUBLIC_USER_ID` hardcodeado incompatible con
  RNF-01.2; (b) `react-native-maps` rompía el build web → shim `PantallaUbicacion.web.tsx`;
  (c) inconsistencia de base URL (anuncios usaba paths sin `/api/v1`) → unificado.

---

## 4. 🔜 LO QUE FALTA

### Fase 3 — Portar chat y moderación de César (a Room_Link)
- ✅ **Chat real (HU-10) — HECHO:** el tab `chats` de Room_Link ya consume `/api/v1/messages`
  (`modulos/chats/api.ts` + `modulos/chats/PantallaChats.tsx`: bandeja con filtros, sala con
  historial/envío/lectura, apertura por sala/conexión/postulación y vista de contexto + reporte).
- **Moderación (HU-13):** portar `frontend/src/modules/moderation` (cola, denuncias,
  historial). Es admin — gatear por `rol` del usuario de la sesión.
- Reusar el design system de César (`frontend/src/shared/ui.js`) para consistencia.

### Fase 4 — Notificaciones (HU-14)  ← objetivo original
- Construir pantalla/centro de notificaciones consumiendo `GET /api/v1/notifications`.
- El backend ya emite notificaciones por evento (event bus). Falta la UI para verlas.
- Decidir si va como 5º tab o como icono/campana en el header.

### Otros módulos sin frontend (backend ya al 100%)
- **Acuerdos de convivencia (HU-12):** `/api/v1/agreements` — pantalla para crear/firmar acuerdo.
- **Conexiones (gestión):** aceptar/rechazar solicitudes. Hoy solo se *envían* desde el feed
  de afinidad (`modulos/compatibilidad/api.ts` → `enviarSolicitudConexion`); falta la pantalla de gestión.
- **Sanciones (admin):** `/api/v1/sanctions` — panel admin móvil.

### Transversal (no-frontend, del session_state)
- Credenciales reales **Google OAuth** + **SMTP** (hoy stubbeados) — los correos de confirmación
  dependen de esto.
- Integration tests dedicados por módulo nuevo (hoy solo smoke).
- Unificación final: una vez portado todo a Room_Link, **eliminar `frontend/`** (app de César) y
  dejar Room_Link como única app.

---

## 5. Orden sugerido para el 100% del frontend
1. **Notificaciones (HU-14)** — el objetivo pedido, ya sobre base autenticada.
2. ✅ **Chat real** (reemplaza el placeholder — completado).
3. **Moderación** (admin).
4. **Acuerdos** → **Conexiones (gestión)** → **Sanciones (admin)**.
5. Eliminar `frontend/` (César) y cerrar la unificación.

---

## 6. Datos útiles / gotchas
- **CORS:** el backend permite orígenes `:8081` y Vite `:5173`, y manda `Access-Control-Allow-Credentials: true`.
  Servir el frontend web en otro puerto lo bloquea.
- **Base URL:** `EXPO_PUBLIC_API_URL` = **origen** (`http://localhost:3000`), los paths llevan `/api/v1`.
- **RNF-01.2:** el backend deriva el `userId` del token de sesión (no del body/URL). El cliente
  manda `Authorization: Bearer <token>`.
- **Testing del cliente:** un smoke por `curl` NO prueba CORS; usar un navegador real
  (ver el E2E en `frontend/tests/e2e/` y `docs/testing.md`). El E2E de regresión corre dev→main.
- **Mapas:** `react-native-maps` solo en nativo; en web hay shim.
