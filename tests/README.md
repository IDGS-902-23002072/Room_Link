# tests

Suites fuera de `frontend/` y `backend/` para pruebas de integración entre módulos (frontend ↔ backend), contratos de API, y utilidades de testing compartidas.

Organización de pruebas:
- `frontend/` — convención Jest (`__tests__/` o `*.test.js`).
- `backend/` — centralizado en `backend/tests/`:
  - `backend/tests/unit/`: Pruebas unitarias de dominio, módulos y servidor.
  - `backend/tests/integration/`: Pruebas de integración contra MySQL.

Convención de etiquetas:
- `*.unit.test.{js,ts}` — unitarias (corren en `ci.yml`).
- `*.integration.test.{js,ts}` — integración (corren en `integration.yml`).
