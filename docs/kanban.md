# Tablero Kanban — Room_Link

Toda tarjeta pasa por estas columnas, en orden. Si retrocede (ej. de **Review** vuelve a **In Progress** porque hubo cambios pedidos), se documenta en el PR.

## Columnas

| Columna         | Qué contiene                                                                                   | Criterio de entrada                                                                 | Criterio de salida                                                                 |
|-----------------|------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| **Backlog**     | Ideas, bugs reportados, chores propuestos. Sin fecha.                                          | Issue creado con uno de los templates.                                              | Alguien la prioriza para el próximo ciclo.                                         |
| **Todo**        | Priorizadas y listas para tomar.                                                               | Cumple **Definition of Ready** (ver abajo).                                         | Alguien se la asigna y abre rama.                                                  |
| **In Progress** | Alguien está trabajando ahora.                                                                 | Rama `feature/*` / `fix/*` / `chore/*` creada; asignado presente.                   | Hay commit funcional y se abre PR.                                                 |
| **Review**      | PR abierto, esperando revisión y CI.                                                           | PR enlazado al issue; checklist del template completo.                              | PR aprobado, CI verde, mergeado a `develop`.                                       |
| **QA**          | Mergeado a `develop`. Falta verificación manual en build de preview.                           | Build de preview disponible (Expo Go o EAS).                                        | Verificado contra criterios de aceptación por alguien distinto al autor.           |
| **Done**        | Entregado. Se queda hasta el próximo corte de release y después se archiva.                    | Cumple **Definition of Done** (ver abajo).                                          | —                                                                                  |

### WIP (Work In Progress) sugerido

- **In Progress**: máximo 2 tarjetas por persona.
- **Review**: máximo 3 en toda la columna. Si se llena, prioridad del equipo es revisar antes de tomar nuevas.
- **QA**: sin límite duro, pero no debería acumular más de un sprint; si crece, hay cuello de botella.

## Definition of Ready (Todo → In Progress)

- Descripción clara del problema o funcionalidad.
- Criterios de aceptación verificables.
- Prioridad y severidad (si aplica) asignadas.
- Dependencias identificadas y resueltas, o la tarjeta va a **Blocked** (label).
- Scope acotado — si parece > 3 días de trabajo, dividir antes de tomar.

## Definition of Done (QA → Done)

- Mergeado a `develop` (o a `main` si es hotfix/release).
- CI verde: lint + unit + integration.
- Verificado manualmente contra todos los criterios de aceptación.
- Documentación actualizada si corresponde (README, docs/, comentarios de env vars).
- Sin TODOs huérfanos ni código comentado introducido por esta tarjeta.
- Issue cerrado con referencia al PR y a la build de preview donde se verificó.

## Labels

### type (una por tarjeta)

| Label            | Color    | Uso                                                       |
|------------------|----------|-----------------------------------------------------------|
| `type: feature`  | `#1f883d`| Nueva funcionalidad.                                      |
| `type: bug`      | `#d1242f`| Comportamiento incorrecto.                                |
| `type: chore`    | `#6e7781`| Mantenimiento, deps, config, refactor sin cambio funcional.|
| `type: docs`     | `#0969da`| Solo documentación.                                       |
| `type: test`     | `#8250df`| Solo cambios en tests.                                    |
| `type: release`  | `#bf8700`| Preparación de release.                                   |
| `type: hotfix`   | `#cf222e`| Fix urgente en producción.                                |

### priority (una por tarjeta)

| Label           | Color     | Uso                                   |
|-----------------|-----------|---------------------------------------|
| `priority: P0`  | `#b60205` | Crítica. Se trabaja ya.               |
| `priority: P1`  | `#d93f0b` | Alta. Entra en el próximo ciclo.      |
| `priority: P2`  | `#fbca04` | Normal. Entra cuando haya capacidad.  |
| `priority: P3`  | `#c5def5` | Baja. Nice to have.                   |

### status (opcional, cambia junto con la columna)

| Label              | Uso                                                  |
|--------------------|------------------------------------------------------|
| `status: todo`     | Lista para tomar.                                    |
| `status: blocked`  | Esperando una dependencia externa o decisión.        |
| `status: in-qa`    | En columna QA.                                       |
| `status: duplicate`| Duplicada de otra tarjeta.                           |
| `status: wontfix`  | Decisión de no implementar.                          |

### area (opcional, pueden coexistir varias)

- `area: ui`
- `area: auth`
- `area: data`
- `area: build`
- `area: ci`

Agregar labels de área a medida que aparezcan módulos.

## Cómo crear el GitHub Project

Una vez que `gh` esté autenticado:

```bash
# 1. Crear el project (v2) a nivel de usuario u org.
gh project create --owner Potato-pdf --title "Room_Link"

# 2. Anotar el número devuelto y agregar las columnas.
#    gh no soporta renombrar columnas default por CLI;
#    hacelo en la UI del Project → Settings → Fields → Status.
#    Dejar las columnas: Backlog, Todo, In Progress, Review, QA, Done.

# 3. Crear las labels de este documento (ver scripts/setup-labels.sh cuando exista).
```

Alternativa 100% UI: Projects → New project → Board → agregar columnas manualmente.

## Flujo típico de una tarjeta

1. Alguien reporta → issue cae en **Backlog** con template y labels de tipo.
2. En planning se prioriza → se mueve a **Todo**, se agrega priority y area.
3. Alguien la toma → se asigna, crea rama `feature/<id>-<kebab>`, mueve a **In Progress**.
4. Push + PR → mueve a **Review**. CI corre automáticamente.
5. PR aprobado + CI verde → merge a `develop`, tarjeta a **QA**.
6. Verifica contra DoD → mueve a **Done**.
7. Al cortar release: tarjetas de **Done** se archivan y se incluyen en el changelog.
