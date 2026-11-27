ALTER TABLE `mon_slo_compliance` ADD `used_3m_window` tinyint DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE VIEW `mon_v_logbook` AS
SELECT
  CAST(r.id AS CHAR) AS id,
  r.occurred_at AS occurred_at,
  CONVERT_TZ(r.occurred_at, '+00:00', '-06:00') AS occurred_at_local,
  'request' AS type,
  COALESCE(c.module, 'PLAT') AS module,
  CONCAT(r.method, ' ', r.route_pattern) AS operation,
  IF(r.is_good = 1, 'éxito', 'error') AS status_label,
  r.duration_ms AS duration_ms,
  LEFT(IFNULL((SELECT e.message FROM mon_error e WHERE e.request_id = r.request_id ORDER BY e.id DESC LIMIT 1), CONCAT('HTTP ', r.status)), 160) AS message,
  r.source AS source,
  r.request_id AS request_id,
  r.sli_id AS sli_id,
  IF(r.source = 'real', 0, 1) AS excluded
FROM mon_request_log r
LEFT JOIN mon_sli_catalog c ON c.sli_id = r.sli_id
UNION ALL
SELECT
  CAST(a.id AS CHAR) AS id,
  a.occurred_at AS occurred_at,
  CONVERT_TZ(a.occurred_at, '+00:00', '-06:00') AS occurred_at_local,
  'business' AS type,
  a.module AS module,
  a.action AS operation,
  CASE WHEN a.result IN ('success', 'ok', 'éxito') THEN 'éxito' ELSE 'error' END AS status_label,
  a.duration_ms AS duration_ms,
  LEFT(a.message, 160) AS message,
  a.source AS source,
  a.request_id AS request_id,
  a.sli_id AS sli_id,
  IF(a.source = 'real', 0, 1) AS excluded
FROM mon_activity_log a
UNION ALL
SELECT
  CAST(p.id AS CHAR) AS id,
  p.checked_at AS occurred_at,
  CONVERT_TZ(p.checked_at, '+00:00', '-06:00') AS occurred_at_local,
  'probe' AS type,
  'PLAT' AS module,
  '/ready' AS operation,
  IF(p.status = 'up', 'éxito', 'error') AS status_label,
  p.latency_ms AS duration_ms,
  LEFT(p.message, 160) AS message,
  p.source AS source,
  p.request_id AS request_id,
  NULL AS sli_id,
  IF(p.source = 'real', 0, 1) AS excluded
FROM mon_probe p
UNION ALL
SELECT
  CAST(t.id AS CHAR) AS id,
  t.occurred_at AS occurred_at,
  CONVERT_TZ(t.occurred_at, '+00:00', '-06:00') AS occurred_at_local,
  'test' AS type,
  t.module AS module,
  t.test_name AS operation,
  IF(t.result = 'passed', 'éxito', 'error') AS status_label,
  t.duration_ms AS duration_ms,
  LEFT(t.message, 160) AS message,
  t.source AS source,
  NULL AS request_id,
  t.sli_id AS sli_id,
  IF(t.source = 'real', 0, 1) AS excluded
FROM mon_test_result t
UNION ALL
SELECT
  CAST(i.id AS CHAR) AS id,
  i.opened_at AS occurred_at,
  CONVERT_TZ(i.opened_at, '+00:00', '-06:00') AS occurred_at_local,
  'incident' AS type,
  i.module AS module,
  CONCAT('incidente #', i.github_issue) AS operation,
  IF(i.closed_at IS NOT NULL, 'éxito', 'error') AS status_label,
  NULL AS duration_ms,
  CONCAT('prioridad ', i.priority) AS message,
  'real' AS source,
  NULL AS request_id,
  NULL AS sli_id,
  0 AS excluded
FROM mon_incident i
UNION ALL
SELECT
  CAST(b.id AS CHAR) AS id,
  b.recorded_at AS occurred_at,
  CONVERT_TZ(b.recorded_at, '+00:00', '-06:00') AS occurred_at_local,
  'backup' AS type,
  'PLAT' AS module,
  CONCAT('respaldo ', b.backup_date) AS operation,
  IF(b.status = 'success', 'éxito', 'error') AS status_label,
  b.duration_ms AS duration_ms,
  LEFT(b.message, 160) AS message,
  b.source AS source,
  NULL AS request_id,
  NULL AS sli_id,
  IF(b.source = 'real', 0, 1) AS excluded
FROM mon_backup_log b;
