# Contribuir a Room_Link

Guía de trabajo del repositorio. Toda contribución pasa por el tablero Kanban en GitHub Projects y respeta el flujo GitFlow light descrito abajo.

## Flujo de ramas (GitFlow light)

Dos ramas permanentes:

- **`main`** — producción. Solo recibe merges desde `release/*` o `hotfix/*`. Cada merge a `main` queda etiquetado con un tag `vX.Y.Z` que dispara el workflow de release.
- **`develop`** — integración continua. Es la rama base de todas las `feature/*` y `fix/*`. El CI de integración corre en cada push a `develop`.

Ramas efímeras (se borran tras el merge):

| Prefijo       | Nace de   | Mergea a         | Uso                                                      |
|---------------|-----------|------------------|----------------------------------------------------------|
| `feature/*`   | `develop` | `develop`        | Nueva funcionalidad.                                     |
| `fix/*`       | `develop` | `develop`        | Bug encontrado antes de release.                         |
| `chore/*`     | `develop` | `develop`        | Tareas de mantenimiento (deps, config, docs).            |
| `release/*`   | `develop` | `main` + `develop` | Preparación de release (bump de versión, changelog).   |
| `hotfix/*`    | `main`    | `main` + `develop` | Fix urgente en producción.                             |

Convención de nombre: `prefijo/<issue-id>-descripcion-corta-kebab`, por ejemplo `feature/42-login-con-google`.

### Reglas duras

- **Nadie commitea directo a `main` ni a `develop`.** Siempre vía PR.
- **PR a `main` requiere revisión + CI verde + tag de release**.
- **PR a `develop` requiere CI verde** (lint + unit). Un reviewer es recomendado pero no bloqueante hasta que haya más de un contribuyente.
- **La rama se borra automáticamente al mergear** (configurable en Settings → General → Pull Requests).

## Convención de commits

Formato [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<scope opcional>): <descripción imperativa en minúsculas>

<cuerpo opcional explicando el porqué, no el qué>

<footer opcional: refs #42, BREAKING CHANGE: ...>
```

Tipos aceptados: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`, `revert`.

Ejemplos:
- `feat(auth): agregar login con google`
- `fix(home): corregir crash cuando la lista está vacía`
- `chore(deps): bump expo a 51.0.14`

## Pull Requests

1. Abrir PR desde `feature/*` → `develop` (o `release/*` → `main`).
2. Completar el template de PR (checklist incluido).
3. Enlazar el issue con `Closes #N` o `Refs #N`.
4. Esperar CI verde. Si falla, corregir en la misma rama; no mergear con tests rotos.
5. Mover la tarjeta del tablero a **Review** al abrir el PR y a **QA** al mergear.

## Definition of Ready (DoR) — para pasar de **Todo** a **In Progress**

- Issue tiene descripción clara, criterios de aceptación y labels.
- Tiene estimación o scope acotado (si aplica).
- No depende de otra tarjeta no cerrada (si tiene dependencia, va a **Blocked** o espera en **Todo**).

## Definition of Done (DoD) — para pasar de **QA** a **Done**

- Código mergeado a `develop`.
- Tests unitarios y de integración pasan en CI.
- Verificado manualmente en una build de preview (Expo Go o EAS).
- Documentación actualizada si cambia API pública, variables de entorno o flujos de usuario.
- Issue cerrado con referencia al PR.

## Entorno local

Pendiente: instrucciones específicas se agregarán al inicializar `app/` con Expo.

Requisitos previos tentativos:
- Node LTS (20.x o 22.x).
- `npm` o `pnpm`.
- Expo CLI vía `npx` (no hace falta instalación global).
- Para builds nativas: Android Studio (emulador) y/o Xcode (iOS, solo macOS).
