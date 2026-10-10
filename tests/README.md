# tests

Suites fuera del `app/` para pruebas de integración entre módulos, contratos de API, y utilidades de testing compartidas.

Las pruebas unitarias viven junto al código en `app/` (convención Jest: `__tests__/` o `*.test.js`).

Convención de etiquetas Jest:
- `*.unit.test.js` — unitarias (corren en `ci.yml`).
- `*.integration.test.js` — integración (corren en `integration.yml`).
