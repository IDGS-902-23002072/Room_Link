# Checklist del requisito del profesor — monitoreo y SLI/SLO

Estados usados: **Hecho** (código y evidencia local), **Parcial** (hay código pero
falta despliegue o ejecución real) y **BLOCKED** (no se puede verificar sin romper una
regla o sin entorno). La fecha de verificación es 2026-11-27.

| # | Requisito (sección 11 del plan) | Estado | Evidencia |
|---|---|---|---|
| 1 | Base de monitoreo independiente de la principal, con usuario y migraciones propias (F1) | Hecho | `infra/mysql/init-monitor.sql`, `backend/drizzle-monitor/`, `backend/src/monitoring/db.ts`; esquema `roomlink_monitor` creado en MySQL `127.0.0.1:3307` |
| 2 | La base principal no contiene tablas `mon_*` ni registros de monitoreo (F1) | Hecho | consulta a `information_schema.TABLES`: 0 tablas `mon_*` en `roomlink`; F4 solo hace `SELECT` |
| 3 | Cada operación relevante se registra al completarse, sin guardar todas las acciones (F2) | Hecho | `requestLogger.ts` encola petición + actividad con el mismo `request_id` y mensaje claro; `activityListener.ts` para eventos de dominio; `messageBuilder.ts` describe login, anuncios, test, postulaciones y rechazos; pruebas en `monitoring.unit.test.ts` y T-44 |
| 4 | Eventos de negocio separados de resultados de prueba (F2/F4) | Hecho | `mon_activity_log` para bitácora de negocio y `mon_test_result` para pruebas; la guía usa `mon_activity_log` en lugar de `mon_business_event` por decisión acordada |
| 5 | Un fallo de la base de monitoreo no afecta ninguna respuesta de la API (F2) | Hecho | escritor asíncrono con cola acotada y stdout JSON; `/ready` no consulta `roomlink_monitor`; prueba “con la base de monitoreo caída la API responde igual” |
| 6 | Pruebas de disponibilidad: `/ready` sondeado cada minuto y guardado (F3) | Parcial | Suite `disponibilidad` con 4/4 pruebas: `/health` y `/ready` con base activa y caída, cada llamada deja un `mon_probe` con mensaje claro (`availabilityProbe.ts`); la demo guardó 1860 sondeos sintéticos; falta el cron de 1 min en la VM (GitHub Actions solo cada 5 min) |
| 7 | Pruebas de funcionalidad por módulo ligadas a su SLI de regla, en cada versión (F4) | Hecho | 15 SLI de regla en `docs/sli-catalog.md`; `npm --prefix backend run test:unit`: 263/263 pasan; CI usa `MONITOR_INGEST_TOKEN` |
| 8 | Pruebas de flujos críticos y de manejo de errores incluidas (F4) | Parcial | suite `funcional` con 8/8 pasos legibles (login, test de convivencia, anuncio, publicación, postulación, decisión y cierre) sin escribir en `roomlink`; `disponibilidad` 4/4; unitario 263/263, monitor 20/20 y smoke 12/12; suite móvil **BLOCKED** (`vitest` no instalado en `frontend/`), E2E móvil/web **BLOCKED** (sin entorno desplegado, ver T-31…T-33) |
| 9 | Resultados y eventos almacenados con fecha, commit y estado (F4) | Hecho | `mon_test_run`, `mon_test_result`, `mon_request_log` y `mon_activity_log`; ingesta con `x-monitor-token` |
| 10 | Los 67 SLI están en el catálogo; sin endpoint se muestran “sin dato” (F1/F5) | Hecho | `backend/drizzle-monitor/` semilla y `docs/sli-catalog.md`; 67 filas cargadas en la base real; T.3 sale “sin dato” en la demo |
| 11 | Cálculos: mes UTC-6, exclusiones, tx buena, ventana de 3 meses, truncado a 1 decimal (F5) | Hecho | `backend/src/monitoring/sliCalculator.ts`, `time.ts`; verificación SQL de la foto `2026-10`; T.1 = 99.5 % con `floor(good*1000/total)/10` |
| 12 | Pantalla de administración con resumen, indicadores, pruebas y bitácora con filtros (F6) | Hecho | `web/src/pages/Monitoring/` con cuatro pestañas; bitácora con mensaje y `request_id` visibles; `Pruebas` ejecuta suites permitidas y muestra «Qué se verificó», «Qué pasó» y «Datos», con SLI/módulo/duración/esperado dentro de «Detalle técnico»; `funcional` y `disponibilidad` aparecen antes que `monitor`; `npm --prefix web run test` y `build` pasan |
| 13 | Pantalla solo para administradores; otro rol recibe 403 (F6) | Hecho | middleware `createAuthMiddleware` + `requireAdmin` por ruta; prueba “niega el panel a un usuario sin rol admin”; la ruta se oculta en navegación |
| 14 | Comparación entre resultado y SLO visible por módulo (F6) | Hecho | pestaña Indicadores: valor, SLO, margen y semáforo; estados verde/rojo/gris |
| 15 | CSV mensual de F1 y retención de 90 días (F7) | Parcial | `scripts/export-monthly.mjs` y `backend/src/monitoring/retention.ts` con modo seco por defecto; descarga HTTP real **BLOCKED** (no se creó sesión admin en `roomlink`), cobertura unitaria del script |
| 16 | Evidencia verificable: cálculo repetible con CSV o SQL directo (F7) | Parcial | verificación SQL real de la demo y prueba unitaria del export con BOM; el CSV real descargado de la API queda **BLOCKED** por el punto 15 |
| 17 | Demo funcional y usable con un mes simulado (F7) | Hecho | `docs/monitoreo-demo.md`; octubre cargó 3806 registros y noviembre 3745; `monitor:slo` guardó 67 filas por mes (28 cumplen en noviembre) |

## Cómo reproducir la evidencia

```bash
npm --prefix backend run typecheck
npm --prefix backend run test:unit
npm --prefix backend run test:monitor
npm --prefix backend run test:smoke
npm --prefix backend run test:functional
npm --prefix backend run test:availability
npm --prefix web run test
npm --prefix web run build
npm --prefix backend run db:monitor:check
npm --prefix backend run monitor:seed:demo -- --period=2026-10
npm --prefix backend run monitor:slo -- --period=2026-10
```

Resultados reales: 34 archivos / 263 pruebas en backend, 20 pruebas de monitor,
12 pruebas smoke, 8 funcionales, 4 de disponibilidad, 23 pruebas web,
`typecheck`, `db:monitor:check` y `build` correctos. `npm --prefix backend run test:integration` falla con
`ER_DBACCESS_DENIED_ERROR` para `roomlink_app` y, además, ejecutarla con otro usuario
haría migraciones e `INSERT` en `roomlink`; por esa razón está **BLOCKED** y no se
ejecutó contra la base principal.

## Pendientes externos documentados

- Cron de `/ready` cada minuto en la VM; GitHub Actions queda como respaldo cada 5 min.
- Credenciales de integración/E2E y entorno desplegado para cerrar T-24, T-32 a T-35.
- Token de sesión admin existente (o autorización para crear uno fuera de `roomlink`)
  para descargar el CSV real por HTTP.
- En volúmenes MySQL ya creados, aplicar `infra/mysql/init-monitor.sql` a mano.
