# Proyecto de monitoreo y SLI/SLO — RoomLink

Fuente de verdad: `docs/plan-monitoreo.md` (diseño) y `docs/SLA.pdf` (medición). Si se contradicen, manda el SLA.

## Reglas que nunca se rompen

- **La base principal `roomlink` NO se modifica**: ni columnas, ni tablas nuevas, ni migraciones, ni datos de prueba del monitoreo. Todo lo nuevo vive en `roomlink_monitor`.
- No cambies fórmulas, metas, umbrales ni criterios del SLA. Si algo no se puede medir, el SLI se muestra “sin dato”; no inventes rutas ni datos.
- Registrar nunca rompe una operación: ningún `await` del registro dentro de la petición; todo error de monitoreo se captura y se manda a stdout como JSON.
- Prohibido guardar: correos, tokens, contraseñas, cuerpos de petición, IP, URLs con ids. Solo patrón de ruta, status, duración, rol y `request_id`.
- La base de monitoreo es un esquema aparte (`roomlink_monitor`) con su propio usuario, pool (máx. 2 conexiones) y migraciones en `backend/drizzle-monitor/`. Nunca crear tablas `mon_*` en la base principal.
- `/ready` no depende de la base de monitoreo.
- Cálculo: guardar en UTC, agrupar por mes en UTC-6, enteros: `floor(good*1000/total)/10`, cumple si `good*100 >= slo*total`. Menos de 30 tx en el mes: acumular los últimos 3 meses.
- Tx buena = status < 500 y duración <= umbral del SLI. Un 4xx también es buena.
- Excluir del registro: `OPTIONS`, `/health`, `/ready`, `/uploads` y el SSE `/messages/rooms/:roomId/events`.
- Reutiliza lo que ya existe: Hono 4, Drizzle, mysql2, Vitest, React 19 + Vite, CSS modules y los componentes actuales. No agregues librerías sin preguntar.
- Cambios mínimos en código existente. Cada fase en commits pequeños, con pruebas. No hagas push.
- Si algo del plan no coincide con el código real, detente y pregunta; no improvises.
- Responde en español, en lenguaje simple.
