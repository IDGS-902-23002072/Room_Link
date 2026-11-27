# scripts

Scripts de automatización (setup de entorno, labels de GitHub, utilidades de release).

Convención: shell scripts `.sh` para POSIX, `.ps1` para Windows. Documentar en el header cada uno qué hace y qué variables de entorno espera.

## Monitoreo (F2/F3/F5)

Los tres scripts son de una sola ejecución; se encargan de enviar datos a
`roomlink_monitor` mediante el endpoint protegido con token. Ninguno escribe en
la base principal `roomlink`.

Variables comunes:

- `ROOMLINK_BASE_URL` (por defecto `http://127.0.0.1:3000`).
- `MONITOR_INGEST_TOKEN` (obligatorio; el mismo que `MONITOR_INGEST_TOKEN` del backend).
- `MONITOR_INGEST_URL` (opcional; reemplaza la URL completa del endpoint).

Sondeo de `/ready` cada minuto (cron propio, fuera de GitHub Actions):

```cron
* * * * * cd /ruta/Room_Link && MONITOR_INGEST_TOKEN=... node scripts/probe-ready.mjs >> logs/monitor-probe.log 2>&1
```

Registro de un respaldo diario (llamar al terminar el respaldo):

```bash
BACKUP_DATE=2026-11-27 BACKUP_STATUS=success \
BACKUP_SIZE_BYTES=123456 BACKUP_DURATION_MS=4200 \
MONITOR_INGEST_TOKEN=... node scripts/record-backup.mjs
```

Ingesta de una corrida de Vitest (la corrida se marca completa solo con `--complete`):

```bash
npm --prefix backend run test:unit:json
MONITOR_INGEST_TOKEN=... npm --prefix backend run monitor:ingest -- --suite=backend:unit --complete
```

El reporte JSON se escribe en `reports/` y ese directorio está ignorado por Git.
Si no hay token o el endpoint no responde, el script solo imprime un evento JSON y
termina con éxito: la monitorización nunca rompe una corrida de pruebas.

`.github/workflows/monitoring.yml` programa el sondeo cada 5 minutos (mínimo de
GitHub Actions). Para cumplir los 60 sondeos por hora de T.1 se recomienda el
cron de una VM con `* * * * *`, según el bloque superior.

## Cierre mensual (F7)

Exportar el CSV de un mes (el token se lee solo del entorno; nunca se pasa por
argumentos ni se imprime):

```bash
ROOMLINK_BASE_URL=http://127.0.0.1:3000 \
MONITOR_ADMIN_TOKEN=... \
npm --prefix backend run monitor:export -- --period=2026-10
```

Guarda `reports/solicitudes-YYYY-MM.csv` con BOM y el encabezado esperado por la
retención. `reports/` está ignorado por Git. La descarga HTTP real requiere una sesión
de administrador; para no escribir en `roomlink` no se creó una, por lo que la
verificación queda cubierta por `backend/tests/unit/monitoring-export-script.unit.test.ts`.

Generar el mes simulado de la demo y su foto mensual:

```bash
npm --prefix backend run monitor:seed:demo -- --period=2026-10
npm --prefix backend run monitor:slo -- --period=2026-10
```

Los datos se marcan `synthetic`/`test`: no contaminan las transacciones reales y
T.3 aparece como “sin dato”. La guía completa está en `docs/monitoreo-demo.md`.

Retención de 90 días. Sin `--apply` solo imprime el plan; con `--apply` borra meses
que tengan foto en `mon_slo_compliance`, CSV válido y 90 días cumplidos:

```bash
npm --prefix backend run monitor:retention -- --period=2026-10
npm --prefix backend run monitor:retention -- --apply --csv-dir=../reports
```

Plantilla de entrega mensual y checklist de cierre: `docs/reporte-mensual.md` y
`docs/checklist-monitoreo.md`.
