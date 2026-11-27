# Guía de demo de monitoreo (octubre y noviembre de 2026)

Esta guía permite repetir la demostración del panel de monitoreo y del cálculo de
SLI/SLO sin tocar la base principal `roomlink`. Todos los datos cargados por la demo
son `synthetic` o `test`; por eso el tráfico real de F1/T.3 aparece como **sin dato**.

La demo original quedó en `2026-10`. Además se cargó una copia sintética en
`2026-11`, que es el mes que el panel abre por defecto. Cargar un mes no borra el otro.

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

Para dejar datos también en el mes actual del panel:

```bash
npm --prefix backend run monitor:seed:demo -- --period=2026-11
npm --prefix backend run monitor:slo -- --period=2026-11
```

Salida observada en la carga de noviembre:

```json
{"origin":"monitoring","event":"monitor_step_finished","step":"seed_demo","period":"2026-11","records":3745}
{"origin":"monitoring","event":"monitor_step_finished","step":"calculate_slo","period":"2026-11","records":67}
```

Después de recalcular noviembre, `mon_slo_compliance` tiene 67 filas: 28 cumplen,
3 no cumplen y 36 siguen **sin dato** por falta de medición real. Ese resultado es
correcto: el panel no inventa valores.

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
| `mon_slo_compliance` (periodo `2026-11`) | 67 |
| `mon_v_logbook` | 3662 (octubre) |

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
`403` sin ese rol. Las rutas están bajo `/api/v1/admin/monitoring`:

- `GET /summary?month=YYYY-MM`
- `GET /slis?month=YYYY-MM`
- `GET /tests/suites` y `POST /tests/run` (ejecución permitida desde el panel)
- `GET /tests/runs` y `GET /tests/runs/:id`
- `GET /logbook?from&to&module&type&status&cursor`
- `GET /export/requests.csv?month=YYYY-MM`

Si la base de monitoreo falla, el panel muestra el error y el resto de la app sigue
funcionando.

La bitácora muestra como columnas propias el **mensaje** y el **`request_id`**
(`Solicitud`). Para eventos sin identificador se muestra `—`. El mensaje está acotado a
160 caracteres en la vista y nunca incluye correos, tokens, IPs ni URLs con ids.

Los mensajes ya no son solo `HTTP 200` o `HTTP 500`. Cada petición guarda una
explicación en `mon_request_log.message` y crea una actividad de negocio con el
mismo `request_id`. La vista `mon_v_logbook` muestra esa actividad (por ejemplo,
«Creación de anuncio» o «Envío de postulación») y oculta la fila de petición para
no duplicar el mismo paso. Las filas antiguas sin mensaje siguen cayendo al mensaje
de error o al código HTTP. Los sondeos de `/health` y `/ready` también dejan su
explicación en `mon_probe`.

## Ejecutar pruebas desde el panel

En `Pruebas` hay un selector de suite y un botón **Ejecutar suite**. Solo se aceptan
estas suites, definidas en `backend/src/monitoring/testRunner.ts`:

| Id | Qué corre |
|---|---|
| `funcional` | `npm run test:functional:json`: login, test de convivencia con candidatos, crear y publicar habitación, postular, aceptar y cerrar. Usa repositorios en memoria y etiqueta `mon-test-AAAAMMDD-xxxx`; no escribe en `roomlink`. Cada paso queda trazable por `request_id`. |
| `disponibilidad` | `npm run test:availability:json`: sondea `/health` y `/ready` con la base disponible y caída, y comprueba que un usuario autenticado consulte el feed de Explorar con un anuncio en memoria. Verifica los mensajes de `mon_probe` y que las peticiones no guarden correos ni contraseñas; no sustituye al cron de producción, pero sí deja la evidencia automática de la app. |
| `monitor` | `npm run test:monitor:json`: infraestructura F1/F2/F3/F5 (bitácora, privacidad, exclusiones y tolerancia a fallos). **No prueba login ni flujos de negocio**: por eso casi todas sus llamadas son `GET` sintéticos. |
| `backend:unit` | `npm run test:unit:json` |
| `backend:smoke` | `npm run test:smoke:json` |

Cuando el profesor pregunte por la aplicación funcionando, hay que elegir
`funcional`. Cuando pregunte por disponibilidad, `disponibilidad`. Cuando pregunte
por la bitácora y el registro, `monitor`. El detalle de cada prueba es corto:
«Qué se verificó», «Qué pasó» y «Datos»; el SLI, el módulo, la duración y lo
esperado quedan dentro de «Detalle técnico», al final.

El botón no envía comandos: el cliente solo manda `{"suite":"..."}` y el servidor
usa una allowlist, `spawn` sin shell, timeout de 3 minutos y una sola corrida a la
vez. El resultado se encola en `roomlink_monitor` con el escritor existente, sin que
ninguna petición espere a la base. Después se recarga la lista y se abre el detalle
con todas las pruebas visibles (el botón alterna a «Solo fallidas»).

Además del resultado, las suites dejan sus pasos reales en la bitácora. La suite
corre en un proceso hijo con `ROOMLINK_EMIT_MONITOR_RECORDS=1`; el puente
`backend/src/monitoring/testRecordBridge.ts` escribe líneas marcadas
`"event":"monitor_record"` y el proceso padre solo lee esas líneas. Todo lo demás
que imprima Vitest se descarta. Antes de encolar, el padre vuelve a sanear cada
registro y fuerza `source='test'`, con lo que estas filas **no cuentan para el SLA**.

En la pestaña Bitácora esos pasos se ven con su nombre de negocio, no como «se hizo
un test»:

| Tipo que muestra el panel | Qué significa |
|---|---|
| Operación de negocio | «Creación de anuncio», «Publicación de anuncio», «Envío de postulación», «Decisión de postulación», «Cierre de anuncio», inicios de sesión y conexiones |
| Petición API | La petición HTTP del paso, saneada y con el mismo `request_id` que su operación |
| Sondeo /ready | Comprobaciones de `/health` y `/ready` de la suite de disponibilidad |
| Prueba automática | Solo el resumen de cada caso de prueba |

La corrida local verificada dejó 42 registros de la suite `funcional` (operaciones
y peticiones) y 5 sondeos de `disponibilidad`, todos con `source='test'` y con su
`request_id`. Las acciones de los eventos de dominio también se muestran en español;
antes aparecían nombres técnicos como `ApplicationStatusChanged`, que además se
descartaban por parecer un secreto al tener 24 caracteres seguidos.

Evidencia real de una ejecución anterior del endpoint contra MySQL (cuando la
suite `monitor` tenía 16 pruebas; hoy tiene 21):

```json
{"origin":"monitoring","event":"test_run_executed","suite":"monitor","exitCode":0,"totalTests":16,"passedTests":16,"failedTests":0}
{"origin":"verificacion","event":"endpoint_result","suite":"monitor","runId":"f2e42f49-c149-48e2-9068-eb6219d57596","totalTests":16,"passedTests":16,"failedTests":0,"queued":17}
```

Eso escribió 1 fila en `mon_test_run` y 16 en `mon_test_result`, con `source='test'`.
Con el puente de registros, además se encolan las operaciones y los sondeos de la
suite. Las corridas locales actuales son: `monitor` 21/21, `funcional` 8/8 y
`disponibilidad` 5/5 (2026-11-27).

Para comprobarlo en MySQL después de ejecutar `funcional` y `disponibilidad` desde
el panel:

```sql
SELECT type, source, COUNT(*) AS filas
FROM roomlink_monitor.mon_v_logbook
WHERE source = 'test'
GROUP BY type, source;

SELECT occurred_at, type, operation, message, request_id
FROM roomlink_monitor.mon_v_logbook
WHERE source = 'test' AND type IN ('business', 'probe')
ORDER BY occurred_at DESC
LIMIT 20;
```

En la tabla `type` sale `business` y `probe` (el panel lo muestra como
«Operación de negocio» y «Sondeo /ready»), además de `test`. Todas tienen
`source='test'` y las de negocio llevan `request_id`.

Verificación real hecha en `roomlink_monitor` con el escritor de Drizzle y la ingesta
(`queued: 4`: 1 corrida, 1 resultado, 1 operación y 1 sondeo):

| `type` | `operation` | `message` | `source` | `request_id` | `excluded` |
|---|---|---|---|---|---|
| `business` | Publicación de anuncio | Se publicó el anuncio de habitación. | `test` | `22222222-2222-4222-8222-222222222222` | 1 |
| `probe` | sondeo de disponibilidad | El sondeo de /ready fue correcto. | `test` | `22222222-2222-4222-8222-222222222222` | 1 |

Eso confirma que la fila de negocio ya no se disfraza de prueba y que ambas quedan
fuera del cálculo SLA.

Las mismas suites se pueden ejecutar desde la terminal en cualquier momento:

```bash
npm --prefix backend run test:functional:json
npm --prefix backend run test:availability:json
npm --prefix backend run test:monitor:json
npm --prefix backend run test:unit:json
npm --prefix backend run test:smoke:json
npm --prefix web run test
```

La web sigue ejecutándose en terminal/CI: su competencia es `node --test` y todavía
no entrega un reporte JSON comparable al de Vitest, por eso no está en la allowlist.

## Corrida E2E real contra `roomlink` (2026-11-27)

A diferencia de la demo sintética, se autorizó escribir **solo datos QA** en la base
principal para probar la app desplegada localmente. No hubo migraciones ni cambios de
esquema. Servicios usados: backend en `127.0.0.1:3000`, Expo web en `127.0.0.1:8081`,
Vite web en `localhost:5173` y MySQL en `127.0.0.1:3307` con `DB_NAME=roomlink`.

```bash
npm --prefix frontend run test
E2E_API_URL=http://127.0.0.1:3000/api/v1 \
E2E_WEB_URL=http://127.0.0.1:8081 \
CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe' \
npm --prefix frontend run test:e2e
```

El primer intento falló porque Expo servía con `EXPO_PUBLIC_API_URL` de otra IP; se
reinició el servidor web con `EXPO_PUBLIC_API_URL=http://127.0.0.1:3000`. Resultado:
**21/21** en `frontend` y **8/8** en el E2E móvil.

Para `qa-roles.spec.mjs` se usó el config propio del repositorio
(`frontend/playwright.qa.config.mjs`) con `E2E_QA_WEB_URL=http://localhost:5173`,
`E2E_QA_MOBILE_URL=http://127.0.0.1:8081` y las credenciales de BD leídas de
`backend/.env` (`DB_PORT=3307`). Resultado: **8/19**:

- 8 fallos por desfase de selectores/navegación frente a la UI actual.
- 1 fallo por Mailpit no disponible en `127.0.0.1:8025`.
- 1 fallo porque Vite dev no sirve service worker PWA.
- 1 fallo porque el paso «Reglas y costos» del flujo Expo ya no coincide con la pantalla.

Al terminar se borraron los usuarios QA, las zonas QA y la imagen subida por la
prueba. La base quedó en 18 usuarios, 3 anuncios, 18 roles y 1 zona, igual que antes
de la corrida. Los Specs no se modificaron.

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

## Aclaraciones frecuentes

- **«Sin dato» en Indicadores.** El panel consulta el mes seleccionado en UTC-6; si
  no hay foto mensual para ese mes, muestra «sin dato». Con la demo de noviembre
  cargada, 28 SLI tienen dato y 36 siguen sin medición. T.3 sigue sin dato porque
  depende de transacciones reales y la demo es sintética. No se inventan valores.
- **`user_id` en el CSV.** La regla de privacidad del proyecto permite guardar solo
  patrón de ruta, estado, duración, **rol** y `request_id`. El CSV ya incluye
  `request_id` y `role`; agregar `user_id` (o un hash del mismo) rompería esa regla,
  así que no se hace.
- **Bitácora.** Los campos Desde, Hasta, Módulo, Tipo de evento y Estado son
  filtros. La tabla incluye además fecha, operación, mensaje, solicitud, estado y
  duración. El Tipo de evento se muestra en español: «Petición API», «Operación de
  negocio», «Sondeo /ready», «Prueba automática», «Incidente» y «Respaldo». Las filas
  de una suite pueden aparecer como «Operación de negocio», «Petición API»,
  «Sondeo /ready» o «Prueba automática», siempre con `source='test'`; no se mezclan
  con el tráfico real.

## Límites de la demo

- No hay sondeo real desplegado: para T.1 en producción se necesita un cron propio en
  la VM (`* * * * *`) porque GitHub Actions solo permite cada 5 minutos.
- No se ejecutaron E2E móvil/web ni integración MySQL; sus filas en
  `docs/matriz-pruebas.md` están marcadas `BLOCKED`.
- Los datos de la demo son sintéticos. No se mezclan con tráfico real ni se cuentan
  como transacciones F1.
- Antes de borrar evidencia por retención deben existir la foto mensual y el CSV; si
  falta uno, el mes se omite.
