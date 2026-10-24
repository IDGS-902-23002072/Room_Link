# Room_Link

Aplicación móvil (Expo + React Native, TypeScript) con backend propio (Hono + TypeScript).

> Estado: la app móvil y el backend están en desarrollo. Los módulos de test de compatibilidad y motor de afinidades ya consumen endpoints del backend.

## Estructura

```
.
├── frontend/         # Proyecto Expo / React Native
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

Para conectar el frontend, copia `frontend/Room_Link/.env.example` a `.env` y define `EXPO_PUBLIC_USER_ID` con el UUID de un usuario activo con perfil. Este identificador es solo una configuración de desarrollo: la API aún no autentica las solicitudes, así que no debe usarse en producción. Si pruebas en un dispositivo físico, configura `EXPO_PUBLIC_API_URL` con la IP local de tu equipo en lugar de `localhost`.

Los módulos 3 y 4 usan `PUT /api/v1/compatibility/:userId` para guardar el test, `GET /api/v1/compatibility/:userId/feed?page=1` para el feed paginado, `GET /api/v1/compatibility/:userId/candidates/:candidateId` para el detalle y `POST /api/v1/compatibility/:userId/connections` para enviar solicitudes. Consulta [backend/README.md](backend/README.md) para el contrato completo.

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

> Los workflows pueden requerir configuración adicional local para ejecutar integración con MySQL o Expo.

## Próximos pasos

1. Completar y validar los módulos restantes conforme a los requerimientos.
2. Crear el GitHub Project (`Room_Link`) y las labels (`scripts/setup-labels.ps1`).
3. Configurar branch protection para `main` y `develop` en Settings → Branches.
4. (Opcional) Agregar `EXPO_TOKEN` como secret del repo para `release.yml`.
