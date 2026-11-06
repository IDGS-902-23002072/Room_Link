# Plan — Backend módulos de Roberto (rama `feature/roberto`)

## [OBJETIVO ACTUAL]
Implementar el backend DDD + MVC para las tres HUs asignadas a Roberto Vargas: perfil de usuario completo (HU-02), filtros de búsqueda avanzada (HU-05) y acuerdos de convivencia digitales (HU-12).

## [ARQUITECTURA/DISEÑO]
- Se respeta el monolito modular con MVC y DDD ya establecido en `backend/`:
  - `domain/entities/` y `domain/repositories/` para entidades y puertos.
  - `infrastructure/repositories/Drizzle*Repository.ts` como ÚNICOS adaptadores a MySQL.
  - `modules/<name>/{controller,service,view,routes,index}.ts` para cada feature.
- Schemas Drizzle existentes se reutilizan: `profilePhotos`, `profileContactPrivacy`, `profileHousingPreferences`, `agreementAgreements`, `agreementAcceptances`, `notifPreferences`, `roomListings`, `roomRules`, `roomCostItems`.
- SOLID:
  - SRP: cada módulo expone una sola área (perfil extendido, búsqueda, acuerdos).
  - OCP/DIP: servicios dependen de interfaces de repositorio, nunca de Drizzle.
  - ISP: interfaces separadas por módulo (`IProfileRepository` se extiende con fotos/privacidad; `ISearchRepository` nuevo; `IAgreementRepository` nuevo).
- Opciones evaluadas y decisión:
  - **A.** Ampliar `IProfileRepository` con fotos+privacidad+notif-prefs vs. **B.** romper en tres interfaces.
    Elegido **A** (coherente con el resto del módulo, un sólo servicio para HU-02; si crece, se parte).
  - **A.** `Search` como módulo propio vs. **B.** mezclar en `profile` y `rooms`.
    Elegido **A** (SRP: filtros cruzan perfiles e inmuebles).
  - **A.** `Agreement` como agregado con sus aceptaciones (DDD) vs. **B.** entidad plana.
    Elegido **A**: el agreement es raíz del agregado y conoce sus firmantes.

## [PASOS DE IMPLEMENTACIÓN (Checklist)]

### Módulo Perfil extendido (HU-02 → issues #2, #32, #34, #35, #36)
- [x] Nuevas entidades `ProfilePhoto`, `ContactPrivacy`, `NotificationPreference`.
- [x] Ampliar entidad `Profile` con `instagram/facebook`, `updateSocials`, `requestIdentityVerification`, `markIdentityVerified`, `rejectIdentityVerification`.
- [x] Ampliar `IProfileRepository` con fotos, privacidad, notif-prefs, identity-request.
- [x] Implementar métodos nuevos en `DrizzleProfileRepository`.
- [x] Ampliar `ProfileService`: `addPhoto`, `removePhoto`, `reorderPhotos`, `getContactPrivacy`, `updateContactPrivacy`, `requestIdentityVerification`, `getNotificationPreferences`, `updateNotificationPreference`, `updateSocials`.
- [x] Rutas HTTP y vistas (fotos CRUD, privacy, verification, notification prefs, socials).
- [x] Validaciones (EL-02.4, EL-02.5): tope 6 fotos, posiciones 1..6, URLs válidas, teléfono/socials con límites.

### Módulo Search (HU-05 → issues #5, #55, #56, #57, #58, #60, #61)
- [x] `SearchFilters` + `PaginatedResult` en domain.
- [x] `ISearchRepository` (`searchProfiles`, `searchListings`, `countProfiles`, `countListings`).
- [x] `DrizzleSearchRepository` con joins a `profileHousingPreferences`, `roomRules`, `geoLocations`.
- [x] `SearchService` con validación de rangos (EL-05.3): min≤max, age≥18, pageSize≤50.
- [x] Controller con endpoints `/profiles`, `/listings` y `/count`.
- [x] Vista con formato estandarizado (items + meta).

### Módulo Agreements (HU-12 → issues #13, #114, #115, #116, #117, #118, #119)
- [x] Entidad `Agreement` (agregado) con `acceptances` y métodos: `accept(userId)`, `assertParticipant`.
- [x] `IAgreementRepository`: `findById`, `findByListing`, `findByUser`, `create`, `recordAcceptance`, `getListingSnapshot`.
- [x] `DrizzleAgreementRepository` (lee `roomRules` + `roomCostItems` para el snapshot).
- [x] `AgreementsService`: `generarAcuerdo`, `aceptarAcuerdo`, `crearNuevaVersion`, `listAgreementsForUser`.
- [x] Validación participantes (EL-12.6): sólo anfitrión o roomie incluidos pueden aceptar.
- [x] Controller + rutas + vista.

### Integración
- [x] Exportar nuevos entities/repos desde `domain/index.ts` e `infrastructure/repositories/index.ts`.
- [x] Registrar los módulos nuevos en `backend/src/app.ts` (DI y `app.route`).
- [x] Exponer módulos vía `modules/<name>/index.ts`.

### Tests (qa-test-gate)
- [x] `tests/unit/profile.extended.unit.test.ts` — service con repo fake: fotos (+límite), privacy, verification request, notif prefs, socials.
- [x] `tests/unit/search.unit.test.ts` — service con repo fake: validación rangos, count, paginación.
- [x] `tests/unit/agreements.unit.test.ts` — generar/aceptar/nueva versión; rechazo a no-participante.
- [x] `tsc --noEmit` y `drizzle-kit check` en el working tree final.
- [x] Reportar matriz qa-test-gate (ver sección final).

## [CRITERIOS DE ACEPTACIÓN]
- Compila sin errores con el tsconfig estricto del backend.
- Los 3 servicios tienen pruebas unitarias con repos en memoria que cubren happy path y reglas de negocio.
- Ningún controller/service importa `db` ni Drizzle; sólo repositorios lo hacen.
- Las rutas HTTP quedan montadas bajo `/api/v1/profiles`, `/api/v1/search` y `/api/v1/agreements`.
- Cambios enlazados a HU-02 (#2), HU-05 (#5), HU-12 (#13) y sus elementos (EL-02.*, EL-05.*, EL-12.*).
- Trabajo queda sólo en working tree (no commits, no push).

## [QA TEST GATE — Resultado]

Working tree verificado al final de la sesión:

| Nivel        | Estado         | Evidencia / comando |
|--------------|----------------|---------------------|
| Unit         | **PASSED**     | `npm run test:unit` → 80 tests, 9 archivos (3 nuevos: `profile.extended`, `search`, `agreements`). |
| Static       | **PASSED**     | `npm run typecheck` (tsc --noEmit, modo estricto) y `npm run db:check` (drizzle-kit, "Everything's fine"). |
| Integration  | NOT APPLICABLE | No existe suite de integración poblada para los módulos nuevos; se dejaron hooks (`AppDependencies.searchRepo`, `agreementsRepo`) para inyectar dobles cuando se agregue MySQL. |
| Smoke        | **PASSED**     | `modules.unit.test.ts` arma `createApp(...)` con repos en memoria y ejerce rutas HTTP end-to-end (`/api/v1/auth/register`, `/api/v1/profiles`, etc.) — los módulos nuevos quedan montados por la misma rutina de `createApp` sin romper esas pruebas. |

Observaciones residuales:
- Las consultas de `DrizzleSearchRepository` usan comparaciones de cadena contra columnas `decimal`; MySQL las aceptará, pero conviene validarlas con integración real cuando se levante la base de datos.
- `DrizzleAgreementRepository.create` hace inserciones encadenadas sin transacción; para producción, envolver en `this.db.transaction(...)` queda como mejora puntual.
