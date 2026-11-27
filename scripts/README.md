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
