# Room_Link: guía para que opencode implemente el monitoreo y los SLI/SLO

## Antes de empezar (lo haces tú, una vez)

1. Crea la rama de trabajo desde `develop` actualizado (es la que tiene los módulos más nuevos, como `geolocation`, que `feature/omar` aún no trae): `git checkout develop && git pull && git checkout -b feature/monitoreo`. Si `develop` cambia mucho, repite la fase 0 antes de seguir.
2. Pon estos dos archivos en el repo:
   - `docs/plan-monitoreo.md`: el plan completo (en el documento, menú de descarga, formato Markdown).
   - `docs/SLA.pdf`: el PDF "IDGS1002 Proyecto 2.1 - Acuerdos de Nivel de Servicio".
3. Copia el bloque "Reglas fijas" de abajo al archivo `AGENTS.md` de la raíz (opencode lo lee solo en cada sesión).
4. Decisiones que deben estar tomadas antes de la fase 3:
   - Sondeo de `/ready` cada minuto: cron propio (no GitHub Actions programado, que no baja de 5 minutos).
   - Lista de cuentas de prueba que se excluyen (correos o ids).
5. Trabaja una fase por sesión de opencode. Al terminar cada una: revisa el diff, corre las pruebas y haz commit antes de pasar a la siguiente.

---

## Reglas fijas (copiar a AGENTS.md)

```md
# Proyecto de monitoreo y SLI/SLO

Fuente de verdad: docs/plan-monitoreo.md (diseño) y docs/SLA.pdf (medición). Si se contradicen, manda el SLA.

Reglas que nunca se rompen:
- No cambies fórmulas, metas, umbrales ni criterios del SLA. Si algo no se puede medir, el SLI se muestra "sin dato"; no inventes rutas ni datos.
- Registrar nunca rompe una operación: ningún await del registro dentro de la petición, todo error de monitoreo se captura y se manda a stdout como JSON.
- Prohibido guardar: correos, tokens, contraseñas, cuerpos de petición, IP, URLs con ids. Solo patrón de ruta, status, duración, rol y request_id.
- La base de monitoreo es un esquema aparte (roomlink_monitor) con su propio usuario, pool (máx. 2 conexiones) y migraciones. Nunca crear tablas mon_* en la base principal.
- /ready no depende de la base de monitoreo.
- Cálculo: guardar en UTC, agrupar por mes en UTC-6, enteros: floor(good*1000/total)/10, cumple si good*100 >= slo*total. Menos de 30 tx en el mes: acumular los últimos 3 meses.
- Tx buena = status < 500 y duración <= umbral del SLI. Un 4xx también es buena.
- Excluir del registro: OPTIONS, /health, /ready, /uploads y el SSE /messages/rooms/:roomId/events.
- Reutiliza lo que ya existe: Hono 4, Drizzle, mysql2, Vitest, React 19 + Vite, CSS modules y los componentes actuales. No agregues librerías sin preguntar.
- Cambios mínimos en código existente. Cada fase en commits pequeños, con pruebas. No hagas push.
- Si algo del plan no coincide con el código real, detente y pregunta; no improvises.
- Responde en español, en lenguaje simple.
```

---

## Cómo usar los prompts

Pega el de la fase en una sesión nueva de opencode. Cada uno ya dice qué leer, qué hacer y cuándo parar. Al final de cada fase pídele: "resume qué archivos tocaste y cómo lo probaste".

### Fase 0. Catálogo de SLI (sin tocar código)

```
Lee docs/plan-monitoreo.md (secciones 2, 5 y 6) y docs/SLA.pdf (secciones 7 y 8).
Tarea: genera docs/sli-catalog.md con una tabla de los 67 SLI: id, módulo, tipo (tx, case, test, platform), umbral en ms, SLO en %, método y patrón de ruta real del backend que lo alimenta.
Verifica cada ruta en backend/src/modules/*/*.routes.ts y app.ts. Si un SLI no tiene ruta (por ejemplo 1.4 baja de cuenta, 6.1 y 6.2 geolocalización), márcalo "sin dato" y explica por qué.
No modifiques código. Al terminar, lista los SLI sin ruta y detente para que yo apruebe.
```

### Fase 1. Base de monitoreo

```
Lee la sección 6 de docs/plan-monitoreo.md y docs/sli-catalog.md aprobado.
Tarea: crear la base de monitoreo.
- Variables MONITOR_DB_HOST, PORT, USER, PASSWORD, NAME en backend/src/config.ts y .env.example, con valores por defecto para desarrollo.
- Pool propio de máximo 2 conexiones en backend/src/monitoring/db.ts.
- Esquema Drizzle de las 12 tablas mon_* y su carpeta de migraciones propia, con los tipos e índices del plan.
- Seed del catálogo mon_sli_catalog desde docs/sli-catalog.md.
- Ajustar compose.yaml para crear el esquema y el usuario de monitoreo.
Criterio: las 12 tablas existen en local y en Docker; la app arranca aunque el esquema de monitoreo no exista. Escribe una prueba que lo compruebe.
```

### Fase 2. Registro de peticiones (F1)

```
Lee la sección 3 y la fase 2 de docs/plan-monitoreo.md.
Tarea: middleware global de Hono (monitoring/requestLogger.ts) y escritor por lotes (monitoring/writer.ts).
- Mide duración y guarda patrón de ruta, método, status, rol, request_id, sli_id (por catálogo), is_good y marca de cuenta de prueba.
- Cola en memoria acotada, lote cada 2 s o 100 filas, reintentos con espera creciente; si se llena, descarta lo más antiguo, cuenta lo descartado y escribe JSON en stdout.
- Aplica las exclusiones de las reglas fijas.
- Registra 5xx y excepciones en mon_error.
- Un solo app.use en backend/src/app.ts.
Criterio: una petición real aparece en mon_request_log con is_good correcto; con la base de monitoreo apagada, las respuestas de la API no cambian ni se retrasan. Escribe pruebas para ambos casos.
Antes de tocar controladores: pregúntame (los errores inesperados hoy salen como 400/401/404).
```

### Fase 2b. Errores 5xx reales (requiere tu visto bueno)

```
Los controladores convierten cualquier error en 400/401/404, lo que infla los SLI.
Tarea: que los errores inesperados devuelvan 5xx (503 si es de base de datos) sin cambiar los errores esperados (AppError con 400, 401, 403, 404, 409, 423).
Muéstrame primero la lista de controladores a tocar y espera mi confirmación. Agrega pruebas que fijen el comportamiento.
```

### Fase 3. Sondeo y respaldos (F2 y F5)

```
Lee la fase 3 de docs/plan-monitoreo.md.
Tarea:
- Endpoint de ingesta de administración (POST bajo /api/v1/admin/monitoring/ingest/...) protegido con token de servicio, que acepte sondeos, resultados de pruebas y respaldos. Valida el cuerpo y limita su tamaño.
- Script scripts/probe-ready.mjs que consulte GET /ready cada minuto y guarde en mon_probe (cron propio).
- Registro de cada respaldo diario en mon_backup_log (adapta scripts/verify-mysql-restore.sh y qa-availability.mjs solo si hace falta).
Criterio: 60 sondeos por hora guardados y un respaldo registrado por día; el endpoint rechaza peticiones sin token.
```

### Fase 4. Pruebas automáticas (F3)

```
Lee la sección 4 de docs/plan-monitoreo.md.
Tarea:
- Etiqueta cada prueba de Vitest relevante con [SLI x.y] en su nombre, empezando por las reglas (1.5, 2.6, 3.3, 4.2, 5.3, 6.3, 7.6, 8.3, 9.5, 10.5, 11.4, 12.4, 13.5, 14.4, 15.3). Donde falte una prueba, créala.
- Reporter JSON de Vitest y script scripts/ingest-vitest.mjs que lo envíe al endpoint de ingesta, marcando la corrida como completa solo si corrió toda la suite.
- Ajusta .github/workflows/ci.yml y regression.yml para ejecutarlo.
- Implementa las pruebas E-01 a E-03 (errores controlados) y D-03 (/ready con la base caída).
Criterio: cada SLI de reglas tiene al menos una prueba ligada y la corrida aparece en mon_test_run y mon_test_result.
```

### Fase 5. Cálculo de SLO e incidentes

```
Lee la sección 5 de docs/plan-monitoreo.md y las reglas fijas.
Tarea: monitoring/sliCalculator.ts que calcule los 67 SLI del mes con enteros, aplique exclusiones (mon_exclusion, cuentas de prueba), ventana de 3 meses y truncado, y guarde la foto mensual en mon_slo_compliance.
- Casos 10.4, 13.4 y 14.3 (monitoring/cases.ts) con usuario de solo lectura sobre la base principal.
- Incidentes desde issues de GitHub (monitoring/incidents.ts) para T.5.
Criterio: las pruebas reproducen los ejemplos numéricos de la sección 5 (97.0 %, 88.7 %, 90.2 %, P95 1,900 ms, 91.6 %) y coinciden con una consulta SQL directa sobre datos de prueba.
```

### Fase 6. API de admin y pantalla

```
Lee la sección 7 de docs/plan-monitoreo.md.
Tarea:
- Backend: módulo backend/src/modules/monitoring/* siguiendo la estructura de analytics, con los endpoints GET summary, slis, tests/runs, tests/runs/:id, logbook y export/requests.csv, solo para administradores (requireAdmin), más la vista mon_v_logbook.
- Web: página web/src/pages/Monitoring/ con 4 pestañas (Resumen, Indicadores, Pruebas, Bitácora), filtros (fechas, módulo, tipo, estado), estados vacíos y de error. Ruta en AppRoutes.jsx y entrada en navigation.js solo para administrador.
- Reutiliza Card, Badge, Meter y Notice. Sin librerías nuevas.
Criterio: un administrador ve el mes completo; un usuario normal recibe 403 y no ve la entrada del menú; si la base de monitoreo falla, la pantalla lo dice sin afectar el resto de la app.
```

### Fase 7. Cierre

```
Lee la fase 7 y la sección 11 de docs/plan-monitoreo.md.
Tarea: script de exportación mensual a CSV (F1), retención de 90 días que borre solo meses ya guardados en mon_slo_compliance y exportados, datos simulados de un mes para la demo y docs/monitoreo-demo.md con los pasos.
Al terminar, recorre el checklist de la sección 11 y marca cada punto con la evidencia (archivo o prueba). Lista lo que quedó pendiente.
```

---

## Revisión después de cada fase (tú)

- `git diff --stat`: ¿solo tocó lo que dice el plan?
- Pruebas del backend y de la web en verde (los scripts de cada `package.json`).
- Búsqueda rápida de datos sensibles en lo que se guarda: ningún correo, token ni cuerpo.
- Con la base de monitoreo apagada, la app sigue respondiendo igual.
