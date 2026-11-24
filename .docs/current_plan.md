# Plan activo — Integración de `feature/roberto` y cierre de HU

## [OBJETIVO ACTUAL]
Integrar `origin/feature/roberto` sobre `develop` resolviendo los 10 conflictos (y los marcadores commiteados en el backend de la rama) sin commitear, y luego completar lo pendiente de cierre **sin tocar los módulos de Avril** (M07/M11/M13 web), con un E2E multi-perfil que valide las HU de punta a punta.

## [ARQUITECTURA/DISEÑO]
- **Merge sin commit.** `git merge --no-ff --no-commit origin/feature/roberto`. El harness prohíbe commitear: se deja el árbol resuelto y staged para que el usuario revise y commitee. Alternativa descartada (cherry-pick selectivo): el usuario pidió merge completo y gran parte del trabajo ya está en `develop`, un merge reconcilia ambas versiones de una vez.
- **Criterio de resolución por archivo.** Para los add/add en `web/src/features/roomlink/*`, la versión de `develop` es la base integrada con 10 commits posteriores; la de Roberto trae búsqueda paginada, privacidad y versionado de acuerdos. Se toma `develop` como base y se incorporan los aportes nuevos de Roberto, verificando con build/typecheck (obs. 0037: los conflictos git subestiman colisiones semánticas de nombres/exports).
- **Backend de Roberto roto.** `app.ts`, `profile.controller.ts`, `search.view.ts` traen marcadores `<<<<<<<` commiteados; hay que resolverlos a mano eligiendo el lado correcto respecto a `develop`, no copiar la rama.
- **Alcance de cierre.** Se trabaja sobre lo de Robert (M05 cableado server-side, M12 persistencia, M15 métricas) y QA/E2E transversal. **NO** se construyen los gaps web de Avril (bandeja M11, sanciones M13).
- **Verificación (qa-test-gate).** Tras resolver: typecheck backend, build+lint `web/`, suites unit/integ existentes, y E2E Playwright multi-perfil. APK: intentar smoke Android, reportar BLOCKED si ADB no ve dispositivo.

## [PASOS DE IMPLEMENTACIÓN (Checklist)]
- [x] `git merge --no-ff --no-commit` (lo corrió el usuario; el hook me lo bloquea a mí). 13 archivos con marcadores (10 conflictos + 3 backend con marcadores commiteados auto-fusionados).
- [x] Resolver conflictos backend (`app.ts`, `profile.controller.ts`, `search.view.ts`) → se conservó HEAD (privacidad HU-02 + detalles de búsqueda).
- [x] Resolver conflictos web: Profile (base develop + `IdentityReviewsPage`+`ContactPrivacy` de Roberto), Search/Agreements/workspace.css (Roberto), Workspace/useResource, `AppRoutes.jsx` (develop + ruta Identidad), `api.js` (HEAD), `Recommendations.jsx` (ambos imports). Fix: Search usa `apiAssetUrl`; api.ts móvil re-exporta `obtenerHabitacionesPublicadas`.
- [x] Resolver conflicto móvil `PantallaExploracion.tsx` → versión de Omar (develop), M04 declarado completo.
- [x] Verificación: typecheck backend ✓ · unit 172 ✓ · integración 9 ✓ (DB compose 3307) · smoke 12 ✓ · web lint/build/test ✓ · móvil typecheck ✓ + unit 19 ✓.
- [x] Árbol resuelto y staged, SIN commitear. **Pendiente: el usuario commitea el merge.**
- [x] (Fase 2) E2E Playwright multi-perfil: suite `qa-roles` completa en verde tras el merge (9 web + 2 Expo skip) + **test nuevo** `HU-02 privacidad de contacto por conexión + M02 revisión de identidad` (4 perfiles: dueño/conexión/ajeno/admin). Total: 10 passed, 2 skipped.
- [ ] (Fase 2) Completar otros pendientes de Robert (HU-05 filtros combinados Vite, M12 dos firmas, M15 métricas) sin tocar módulos de Avril.
- [ ] (Fase 2) Smoke APK Android (o reporte BLOCKED con motivo).

## [CRITERIOS DE ACEPTACIÓN]
- `git status` muestra el merge resuelto y staged, sin marcadores `<<<<<<<` en ningún archivo, SIN commit creado.
- Typecheck de backend en verde (sin marcadores en `app.ts`, `profile.controller.ts`, `search.view.ts`).
- `web/` compila y lintea; suites unit/integración existentes en verde o con BLOCKED justificado.
- E2E multi-perfil pasa las HU afectadas; resultados reportados por la matriz de qa-test-gate.
- No se modifican los módulos de Avril (M07/M11/M13 web) como parte del cierre.
