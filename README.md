# Room_Link

Aplicación móvil (Expo + React Native, JavaScript) con backend propio (Bun + TypeScript).

> Estado: **infraestructura backend inicializada**. MySQL, Drizzle, Hono y TypeScript están listos; el frontend y los módulos de dominio todavía están pendientes.

## Estructura

```
.
├── frontend/         # Proyecto Expo / React Native (pendiente de inicializar)
├── backend/          # API Hono + Drizzle + TypeScript (Node.js o Bun)
├── compose.yaml      # MySQL 8.4 y ejecución automática de migraciones
├── docs/             # Documentación del proyecto
│   └── kanban.md     # Tablero, columnas, DoR/DoD, labels
├── scripts/          # Automatización (labels de GitHub, etc.)
├── tests/            # Tests fuera de frontend/backend (integración entre módulos)
└── .github/          # Templates de issue/PR, workflows CI, CODEOWNERS
```

## Trabajo con el repo

- Flujo de ramas y convenciones de commits: [CONTRIBUTING.md](CONTRIBUTING.md).
- Tablero Kanban y Definition of Done: [docs/kanban.md](docs/kanban.md).
- Base de datos con y sin Docker: [docs/database.md](docs/database.md).

## Base de datos y backend

Para levantar MySQL en Docker desde la raíz:

```bash
docker compose up --build --wait
```

El contenedor publica MySQL en `localhost:3307` para poder coexistir con una instalación local en `3306`. La guía de base de datos también explica cómo trabajar sin Docker.

El backend puede arrancarse ejecutando:

```bash
cd backend
DB_PORT=3307 npm run dev
```

La documentación detallada del backend, su arquitectura de monolito modular con DDD y la guía de Drizzle ORM se encuentran en:
- [backend/README.md](backend/README.md)
- [docs/drizzle-guide.md](docs/drizzle-guide.md)


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
2. Definir el contrato de API y construir los módulos de dominio sobre Hono y Drizzle.
3. Crear el GitHub Project (`Room_Link`) y las labels (`scripts/setup-labels.ps1`).
4. Cargar las primeras tarjetas desde los requerimientos.
5. Configurar branch protection para `main` y `develop` en Settings → Branches.
6. (Opcional) Agregar `EXPO_TOKEN` como secret del repo para `release.yml`.
