# Room_Link

Aplicación móvil (Expo + React Native, JavaScript) con backend propio (Bun + TypeScript).

> Estado: **pre-requirements**. El repositorio está preparado para desarrollo Kanban; `frontend/` y `backend/` todavía no están inicializados.

## Estructura

```
.
├── frontend/         # Proyecto Expo / React Native (pendiente de inicializar)
├── backend/          # API Bun + TypeScript (pendiente de inicializar)
├── docs/             # Documentación del proyecto
│   └── kanban.md     # Tablero, columnas, DoR/DoD, labels
├── scripts/          # Automatización (labels de GitHub, etc.)
├── tests/            # Tests fuera de frontend/backend (integración entre módulos)
└── .github/          # Templates de issue/PR, workflows CI, CODEOWNERS
```

## Trabajo con el repo

- Flujo de ramas y convenciones de commits: [CONTRIBUTING.md](CONTRIBUTING.md).
- Tablero Kanban y Definition of Done: [docs/kanban.md](docs/kanban.md).

## Branches

- `main` — producción.
- `develop` — integración continua, base de todas las `feature/*` / `fix/*` / `chore/*`.

## CI

Cuatro workflows en `.github/workflows/`:

| Workflow            | Dispara en                             | Qué hace                                                           |
|---------------------|----------------------------------------|--------------------------------------------------------------------|
| `ci.yml`            | PR a `develop` o `main`, push a `develop` | Lint + tests unitarios (frontend con npm, backend con Bun).      |
| `integration.yml`   | Push a `develop`, manual                | Tests de integración (frontend y backend por separado).            |
| `release.yml`       | Tag `v*.*.*`, manual                    | Build EAS del frontend (perfil `preview` o `production`).          |
| `pr-labeler.yml`    | PR abierto/editado                      | Etiqueta automática por prefijo de rama.                           |

> Cada job frontend/backend se saltea solo hasta que exista el `package.json` correspondiente. Si ambos faltan, corre `bootstrap-notice` como placeholder.

## Próximos pasos

1. Inicializar la app en `frontend/` cuando lleguen los requerimientos (`npx create-expo-app@latest .`).
2. Inicializar el backend en `backend/` (`bun init`) y definir contrato de API.
3. Crear el GitHub Project (`Room_Link`) y las labels (`scripts/setup-labels.ps1`).
4. Cargar las primeras tarjetas desde los requerimientos.
5. Configurar branch protection para `main` y `develop` en Settings → Branches.
6. (Opcional) Agregar `EXPO_TOKEN` como secret del repo para `release.yml`.
