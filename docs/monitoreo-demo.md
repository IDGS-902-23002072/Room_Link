# Guía de demo de monitoreo (mes simulado 2026-10)

Esta guía permite repetir la demostración del panel de monitoreo y del cálculo de
SLI/SLO sin tocar la base principal `roomlink`. Todos los datos cargados por la demo
son `synthetic` o `test`; por eso el tráfico real de F1/T.3 aparece como **sin dato**.

## Qué se muestra

- Esquema separado `roomlink_monitor` con usuario propio, migraciones propias y pool
  de máximo 2 conexiones.
- 67 SLI en `mon_sli_catalog` y su foto mensual en `mon_slo_compliance`.
- 15 SLI de regla (F3), 3 casos a tiempo (F4) y 6 indicadores de plataforma (F2/F5/F6).
- Bitácora unificada en `mon_v_logbook` con eventos de petición, actividad de negocio,
  sondeos, resultados de prueba, respaldos e incidentes.
- Panel web de administración con cuatro pestañas: Resumen, Indicadores, Pruebas y
  Bitácora.

## Prerrequisitos

1. MySQL local en `127.0.0.1:3307` (el usado para la verificación).
2. Esquema y usuario creados con `infra/mysql/init-monitor.sql` en volúmenes ya
   existentes. En una instalación nueva, el contenedor ya lo aplica.
3. Variables `MONITOR_DB_HOST`, `MONITOR_DB_PORT`, `MONITOR_DB_USER`,
   `MONITOR_DB_PASSWORD` y `MONITOR_DB_NAME=roomlink_monitor` configuradas en
   `backend/.env`.

La aplicación arranca aunque `roomlink_monitor` no exista: `/ready` solo consulta
`roomlink`, y el registro de monitoreo nunca bloquea una respuesta.

## Comandos reproducibles

Desde la raíz del repositorio:

```bash
npm --prefix backend run db:monitor:check
npm --prefix backend run db:monitor:migrate
npm --prefix backend run db:monitor:seed
npm --prefix backend run monitor:seed:demo -- --period=2026-10
npm --prefix backend run monitor:slo -- --period=2026-10
```

Salida observada en la ejecución real:

```json
{"origin":"monitoring","event":"monitor_step_finished","step":"seed_demo","period":"2026-10","records":3806}
{"origin":"monitoring","event":"monitor_step_finished","step":"calculate_slo","period":"2026-10","records":67}
```

Para recalcular F4 y F6 sobre el mismo mes:

```bash
npm --prefix backend run monitor:cases -- --period=2026-10
npm --prefix backend run monitor:incidents -- --period=2026-10
npm --prefix backend run monitor:slo -- --period=2026-10
```

El script `monitor:monthly` encadena esos tres pasos sin banderas; úsalo solo cuando
el periodo deseado sea el mes actual en UTC-6.

## Evidencia verificada en MySQL

Conteo directo sobre `roomlink_monitor` después de la carga:

| Tabla / vista | Filas |
|---|---:|
| `mon_request_log` | 1720 |
| `mon_probe` | 1860 |
| `mon_backup_log` | 31 |
| `mon_test_result` | 15 |
| `mon_case_event` | 120 |
| `mon_incident` | 6 |
| `mon_slo_compliance` (periodo `2026-10`) | 67 |
| `mon_v_logbook` | 3662 |

Además, la consulta a `information_schema.TABLES` devolvió **0 tablas `mon_*` en
`roomlink`**.

Resultados de la foto mensual `2026-10`:

| SLI | Valor | SLO | Estado | Observación |
|---|---:|---:|---|---|
| T.1 | 99.5 % | 95 % | cumple | 1852 sondeos buenos de 1860 |
| T.2 | racha de 8 min | ≤ 12 h | cumple | racha más larga de fallos consecutivos |
| T.3 | sin dato | 95 % | sin dato | las transacciones de la demo son `synthetic` |
| T.4 | 100 % | 90 % | cumple | casos a tiempo con F4 |
| T.5 | 83.3 % | 90 % | no cumple | 5 de 6 incidentes dentro de plazo |
| 15.3 | 0 % | 90 % | no cumple | collar de pruebas: 14 de 15 reglas pasan |
| 1.5, 3.3, 10.4 | 100 % | 90 % | cumple | SLI de regla en la corrida demo |

`mon_slo_compliance` guarda el valor con la fórmula del SLA:
`floor(good*1000/total)/10`, y cumple si `good*100 >= slo*total`. El mes se agrupa en
UTC-6 aunque los datos se guarden en UTC. Cuando un SLI tiene menos de 30
transacciones se usa la ventana de 3 meses y el panel lo etiqueta.

## Cómo verlo en el panel

Con el backend en marcha, iniciar sesión con un usuario con rol `admin` y abrir
`/admin/monitoreo`. El frontend oculta la ruta para otros roles y el backend devuelve
`403` sin ese rol. Las seis rutas de solo lectura están bajo
`/api/v1/admin/monitoring`:

- `GET /summary?month=YYYY-MM`
- `GET /slis?month=YYYY-MM`
- `GET /tests/runs` y `GET /tests/runs/:id`
- `GET /logbook?from&to&module&type&status&cursor`
- `GET /export/requests.csv?month=YYYY-MM`

Si la base de monitoreo falla, el panel muestra el error y el resto de la app sigue
funcionando.

## Export y retención

El CSV mensual se descarga con token de administrador (nunca por argumentos ni en
logs):

```bash
ROOMLINK_BASE_URL=http://127.0.0.1:3000 \
MONITOR_ADMIN_TOKEN=... \
npm --prefix backend run monitor:export -- --period=2026-10
```

Guarda `reports/solicitudes-2026-10.csv` con BOM. En esta verificación no se creó una
sesión admin en `roomlink` (eso escribiría en la base principal), así que la descarga
HTTP real queda documentada como `BLOCKED`; la cobertura del script está en
`backend/tests/unit/monitoring-export-script.unit.test.ts`, con servidor HTTP local y
token falso.

La retención es segura por defecto:

```bash
npm --prefix backend run monitor:retention -- --period=2026-10
npm --prefix backend run monitor:retention -- --apply --csv-dir=../reports
```

Sin `--apply` solo imprime el plan. Con `--apply` borra únicamente meses que tienen
foto en `mon_slo_compliance`, CSV válido y 90 días cumplidos.

## Límites de la demo

- No hay sondeo real desplegado: para T.1 en producción se necesita un cron propio en
  la VM (`* * * * *`) porque GitHub Actions solo permite cada 5 minutos.
- No se ejecutaron E2E móvil/web ni integración MySQL; sus filas en
  `docs/matriz-pruebas.md` están marcadas `BLOCKED`.
- Los datos de la demo son sintéticos. No se mezclan con tráfico real ni se cuentan
  como transacciones F1.
- Antes de borrar evidencia por retención deben existir la foto mensual y el CSV; si
  falta uno, el mes se omite.
