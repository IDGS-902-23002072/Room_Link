# Room_Link

Aplicación móvil (Expo + React Native, JavaScript).

> Estado: **pre-requirements**. El repositorio está preparado para desarrollo Kanban; la app en `app/` todavía no está inicializada.

## Estructura

```
.
├── app/              # Proyecto Expo (pendiente de inicializar)
├── docs/             # Documentación del proyecto
│   └── kanban.md     # Tablero, columnas, DoR/DoD, labels
├── scripts/          # Automatización (labels de GitHub, etc.)
├── tests/            # Tests fuera de app/ (integración entre módulos)
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

| Workflow            | Dispara en                             | Qué hace                                        |
|---------------------|----------------------------------------|-------------------------------------------------|
| `ci.yml`            | PR a `develop` o `main`, push a `develop` | Lint + tests unitarios.                      |
| `integration.yml`   | Push a `develop`, manual                | Tests de integración.                           |
| `release.yml`       | Tag `v*.*.*`, manual                    | Build EAS (perfil `preview` o `production`).   |
| `pr-labeler.yml`    | PR abierto/editado                      | Etiqueta automática por prefijo de rama.       |

> Los jobs se saltean solos hasta que exista `app/package.json`.

## Próximos pasos

1. Inicializar la app en `app/` cuando lleguen los requerimientos.
2. Crear el GitHub Project (`Room_Link`) y las labels (`scripts/setup-labels.ps1`).
3. Cargar las primeras tarjetas desde los requerimientos.
4. Configurar branch protection para `main` y `develop` en Settings → Branches.
5. (Opcional) Agregar `EXPO_TOKEN` como secret del repo para `release.yml`.
