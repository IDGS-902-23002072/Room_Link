# Plantilla de reporte mensual de SLI/SLO — RoomLink

Copiar esta plantilla para cada mes. Entregar a más tardar **5 días hábiles después del
cierre del mes**. Si una fuente no tiene datos, escribir **sin dato**; nunca `0 %` ni
`100 %` por falta de registros. No cambiar fórmulas, metas ni umbrales del SLA.

## 1. Encabezado

| Campo | Valor |
|---|---|
| Mes (UTC-6) | `YYYY-MM` |
| Responsable |  |
| Fecha de cierre |  |
| Fecha de entrega (≤ 5 días hábiles) |  |
| Commit / versión desplegada |  |
| Entorno | producción / QA / demo |
| Fuentes usadas | F1 peticiones, F2 sondeos, F3 pruebas, F4 BD principal (solo lectura), F5 respaldos, F6 incidencias |
| CSV | `reports/solicitudes-YYYY-MM.csv` |
| Foto mensual | `mon_slo_compliance` para `YYYY-MM` |

Regla de cálculo aplicada: guardar en UTC, agrupar por mes en UTC-6,
`floor(good*1000/total)/10`, cumple si `good*100 >= slo*total`. Tx buena = status `<500`
y duración `≤` umbral del SLI (4xx cuenta como buena). Menos de 30 tx en el mes:
acumular los últimos 3 meses y marcar la fila como “ventana de 3 meses”.

## 2. Resumen ejecutivo

| Indicador | Valor | Meta | Estado | Evidencia |
|---|---:|---:|---|---|
| T.1 disponibilidad (`/ready`) |  | ≥ 95 % |  | `mon_probe`, `mon_slo_compliance` |
| T.2 caída más larga |  | ≤ 12 h |  | racha de sondeos fallidos consecutivos |
| T.3 transacciones `/api/v1/*` |  | ≥ 95 % en ≤ 3 s |  | `mon_request_log`, CSV |
| T.4 casos a tiempo |  | ≥ 90 % |  | `mon_case_event` (F4) |
| T.5 incidentes P0–P3 a tiempo |  | ≥ 90 % |  | `mon_incident` (F6) |
| T.6 reporte entregado |  | ≤ 5 días hábiles |  | este documento |
| SLO de regla cumplidos |  / 15 | ≥ 90 % por SLI |  | última corrida completa del mes |

Plazos T.5 usados: `P0=4 h`, `P1=9 h`, `P2=18 h`, `P3=45 h`, contados solo en
09:00–18:00 UTC-6, lunes a viernes.

## 3. Indicadores por módulo

Completar una fila por cada SLI del catálogo (43 de transacciones, 15 de regla, 3 de
casos y 6 de plataforma). Copiar las filas según necesidad.

| ID | Módulo / operación | Fuente | Total | Buenos | Valor | SLO | Cumple | Ventana 3 m | Sin dato | Observación |
|---|---|---|---:|---:|---:|---:|---|---|---|---|
| 1.1 | M1 alta | F1 |  |  |  |  |  |  |  |  |
| 1.5 | M1 reglas | F3 |  |  |  | ≥ 90 % |  | no aplica |  |  |
| … | … | … |  |  |  |  |  |  |  |  |
| T.1 | Plataforma | F2 |  |  |  | ≥ 95 % |  | no aplica |  |  |
| T.6 | Plataforma | reporte |  |  |  | ≤ 5 días |  | no aplica |  |  |

Los SLI sin endpoint o sin corrida completa se dejan en **sin dato**. La bitácora no
guarda correos, tokens, contraseñas, cuerpos, IP ni URLs con ids: solo patrón de ruta,
status, duración, rol y `request_id`.

## 4. Pruebas automáticas

| Suite | Corrida | Commit | Casos | Pasadas | Fallidas | Omitidas | Completa | SLI alimentados |
|---|---|---|---:|---:|---:|---:|---|---|
| `backend:unit` |  |  | 249 | 249 | 0 | 0 |  | 1.5–15.3 |
| `backend:smoke` |  |  | 12 | 12 | 0 | 0 |  | flujos críticos con fakes |
| `web` |  |  | 23 | 23 | 0 | 0 |  | 3.3, 15.3 |
| `frontend:unit` |  |  | 21 |  |  |  | no | BLOCKED: `vitest` no instalado en `frontend/` |
| `backend:integration` |  |  | 9 |  |  |  | no | BLOCKED sin escritura en `roomlink` |
| E2E móvil / roles |  |  |  |  |  |  | no | BLOCKED sin entorno desplegado |

Solo la última corrida **completa** del mes alimenta los SLI de regla. Registrar los
resultados con `npm --prefix backend run monitor:ingest -- --suite=... --complete`
solo cuando la suite haya terminada en su totalidad.

## 5. Disponibilidad y respaldos

| Día | Sondeos | Buenos | Caídas | Respaldo | Tamaño | Duración | Estado |
|---|---:|---:|---:|---|---:|---:|---|
|  |  |  |  |  |  |  |  |

La ingesta de sondeos requiere `x-monitor-token`; si no hay token, el script lo omite
sin romper la corrida.

## 6. Incidentes y plazos T.5

| ID | Prioridad | Apertura (UTC-6) | Cierre/resolución | Plazo | Dentro de plazo | Estado real |
|---|---|---|---|---|---|---|
|  | P0/P1/P2/P3 |  |  | 4 h / 9 h / 18 h / 45 h | sí / no | abierto / resuelto |

No inventar horas: si no hay marca de resolución, el estado es **sin dato** y no se
cuenta como cumplido.

## 7. Repetibilidad y evidencia

1. Foto mensual: `npm --prefix backend run monitor:slo -- --period=YYYY-MM`.
2. CSV: ver `docs/monitoreo-demo.md`; conservar BOM y encabezado `period,...,is_good`.
3. SQL directo: consultar `roomlink_monitor.mon_slo_compliance` para el periodo y
   comparar `good`, `total`, `sli_value`, `slo_value` y `compliant` con el CSV.
4. Retención: ejecutar primero sin `--apply`; borrar solo si hay foto, CSV válido y
   90 días cumplidos.
5. Adjuntar rutas de evidencia, hashes o capturas del panel. No adjuntar tokens ni
   datos personales.

## 8. Cierre

| Revisado por | Fecha | Observaciones | Firma |
|---|---|---|---|
|  |  |  |  |
