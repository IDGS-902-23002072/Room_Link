# tests

Suites fuera de `frontend/` y `backend/` para pruebas de integración entre módulos (frontend ↔ backend), contratos de API, y utilidades de testing compartidas.

Las pruebas unitarias viven junto al código:
- `frontend/` — convención Jest (`__tests__/` o `*.test.js`).
- `backend/` — convención `bun test` (`*.test.ts` junto al archivo).

Convención de etiquetas:
- `*.unit.test.{js,ts}` — unitarias (corren en `ci.yml`).
- `*.integration.test.{js,ts}` — integración (corren en `integration.yml`).
