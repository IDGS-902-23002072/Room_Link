# Brief para Roberto — M15: Dashboard admin móvil (analytics)

**Objetivo:** portar a la app móvil (`frontend/Room_Link`) el dashboard de métricas
admin que ya construiste en el portal web, siguiendo los mockups M15. Es trabajo
**independiente** del flujo de arrendador (M09) que hace César — no se pisan.

---

## 1. Qué construir — 3 pantallas (mockups Figma)

Archivo de mockups: `RoomLink · Mockups móviles`
(`https://www.figma.com/design/T8jvKu359yVrrV3tDTGp1e/...`)

| Pantalla | node-id | Contenido |
|---|---|---|
| **M15.1 · RoomLink en números** | `3:89` | KPIs principales (usuarios, anuncios, conexiones, etc.) |
| **M15.2 · Actividad y ocupación** | `3:90` | Serie por rango de fechas (altas, publicaciones, ocupación) |
| **M15.3 · Calidad del matching** | `3:91` | Métricas de afinidad/matching |

Pueden ir como **una sola pantalla con 3 tabs/secciones** (como hace la encuesta
con pasos) o 3 vistas — a tu criterio, pero fieles al mock.

## 2. Backend (ya está listo — no hay que tocarlo)

Endpoint: **`GET /api/v1/admin/analytics`** (requiere sesión admin, header `Authorization: Bearer <token>`)
- `?start=YYYY-MM-DD&end=YYYY-MM-DD` → dashboard con `{ kpis, monthlyUsers, monthlyListings }`
- `?from=&to=` → corte diario (lista de `DailyMetricsDTO`)
- `POST /api/v1/admin/analytics/recompute?date=YYYY-MM-DD` → recalcula un día

Es el **mismo backend** que consume tu dashboard web (`web/src/features/roomlink/…`),
así que la lógica de datos ya la conocés; esto es portar la UI a React Native.

## 3. Dónde enchufarlo (en la app móvil)

- Nueva ruta: `frontend/Room_Link/src/app/analytics.tsx` (o `admin-metricas.tsx`)
  → renderiza la pantalla nueva.
- Entrada desde **`PantallaPerfil`**: agregá un `<Link href="/analytics">` en la
  sección **admin** (junto a los links de `/moderacion` y `/sanciones`, que ya
  están gateados por `rol === 'admin'`). Copiá ese patrón de gating.

## 4. Cómo llamar al backend (patrón de la app)

Usá el cliente con sesión, como el resto de los módulos. Ejemplo (mirá
`modulos/sanciones/api.ts` o `modulos/moderacion/api.ts` como referencia):
```ts
import { apiFetch } from '@/modulos/compatibilidad/api'; // helper con Bearer + base URL
// GET /admin/analytics?start=...&end=...
```
- Base URL: `EXPO_PUBLIC_API_URL` (= origen, sin `/api/v1`), los paths llevan `/api/v1`.
- El token sale de la sesión (`@/auth/sesion`). No pasar userId por body/URL (RNF-01.2).

## 5. Referencias de estilo/componentes

- Tema y componentes: `src/constants/theme.ts`, `components/themed-text.tsx`,
  `components/themed-view.tsx`.
- Pantallas admin existentes como molde: `modulos/moderacion/PantallaModeracion.tsx`
  y `modulos/sanciones/PantallaSanciones.tsx` (header "ROOMLINK / NN", tabs, gating admin).
- Para medidores/barras podés reusar el patrón de `modulos/encuesta/componentes/MedidorResultado.tsx`.

## 6. Aceptación
- Las 3 vistas M15 renderizan datos **reales** del backend (no mocks).
- Gateadas por rol admin (un no-admin no las ve).
- Compila (`npm run build:web`) y no rompe el E2E existente (`npm run test:e2e`).
- Trabajá en tu rama `feature/roberto` y abrí PR a `develop`.

## 7. Qué NO tocar (lo hace César en paralelo)
- `modulos/postulaciones/` y `modulos/anuncios/` (flujo de arrendador M07/M09).
- `app/_layout.tsx` (routing raíz).
