import { useEffect, useState } from 'react'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import {
  downloadRequestsCsv,
  formatDuration,
  formatPercent,
  getSummary,
} from './monitoring.js'
import styles from './Monitoring.module.css'

function Metric({ label, value, note, tone }) {
  return (
    <Card className={styles.card}>
      <p className={styles.cardLabel}>{label}</p>
      <p className={styles.cardValue}>{value}</p>
      {note ? <p className={styles.cardNote}>{note}</p> : null}
      {tone ? <Badge tone={tone.tone}>{tone.label}</Badge> : null}
    </Card>
  )
}

export default function SummaryTab({ month, token }) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => asyncEffect(async (isActive) => {
    setLoading(true)
    try {
      const data = await getSummary(month, token)
      if (isActive()) {
        setSummary(data)
        setError('')
      }
    } catch (cause) {
      if (isActive()) {
        setSummary(null)
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.')
      }
    } finally {
      if (isActive()) setLoading(false)
    }
  }), [month, token])

  async function download() {
    setDownloading(true)
    setDownloadError('')
    try {
      await downloadRequestsCsv(month, token)
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : 'No se pudo exportar el CSV.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <p className={styles.loading} role="status">Cargando el resumen del mes…</p>
  if (error) {
    return (
      <Notice role="alert" tone="error" title="No se pudo consultar la base de monitoreo">
        {error} El resto de RoomLink sigue funcionando. Inténtalo de nuevo en unos minutos.
      </Notice>
    )
  }
  if (!summary) return null

  const availabilityTone = summary.availability.compliant === null
    ? { label: 'Sin dato', tone: 'neutral' }
    : summary.availability.compliant
      ? { label: 'Cumple', tone: 'success' }
      : { label: 'No cumple', tone: 'danger' }

  return (
    <div className={styles.stack}>
      <div className={styles.cards}>
        <Metric
          label="Disponibilidad (T.1)"
          value={formatPercent(summary.availability.value)}
          note={summary.availability.slo === null ? 'Sin objetivo cargado' : `Meta ${formatPercent(summary.availability.slo)}`}
          tone={availabilityTone}
        />
        <Metric
          label="Caída más larga (T.2)"
          value={summary.outage.minutes === null ? 'sin dato' : `${summary.outage.minutes} min`}
          note={summary.outage.limitMinutes === null
            ? summary.outage.message
            : `Límite ${formatDuration(summary.outage.limitMinutes * 60_000)}`}
          tone={summary.outage.compliant === null
            ? { label: 'Sin dato', tone: 'neutral' }
            : summary.outage.compliant
              ? { label: 'Dentro del límite', tone: 'success' }
              : { label: 'Fuera de límite', tone: 'danger' }}
        />
        <Metric
          label="SLO cumplidos"
          value={summary.sloMet.met === null ? 'sin dato' : `${summary.sloMet.met} de ${summary.sloMet.total}`}
          note="Indicadores del catálogo con foto mensual"
        />
        <Metric
          label="Transacciones reales"
          value={`${summary.transactions.good} buenas`}
          note={`${summary.transactions.bad} fallidas o lentas · ${summary.transactions.serverErrors} errores 5xx`}
        />
        <Metric
          label="Última corrida de pruebas"
          value={summary.lastTestRun
            ? `${summary.lastTestRun.passedTests}/${summary.lastTestRun.totalTests}`
            : 'sin dato'}
          note={summary.lastTestRun
            ? `${summary.lastTestRun.suite} · ${summary.lastTestRun.complete ? 'completa' : 'incompleta'}`
            : 'No hay corridas en el mes'}
        />
        <Metric
          label="Último respaldo"
          value={summary.lastBackup?.date ?? 'sin dato'}
          note={summary.lastBackup?.status === 'success' ? 'Correcto' : (summary.lastBackup?.status ?? 'Sin registro')}
        />
      </div>

      <Card className={styles.exportCard}>
        <div>
          <h2 className={styles.sectionTitle}>Exporte del mes</h2>
          <p className={styles.cardNote}>
            CSV con patrón de ruta, estatus, duración y rol. Sin correos, tokens ni URLs con identificadores.
          </p>
        </div>
        <Button loading={downloading} onClick={download} variant="secondary">
          Descargar solicitudes (CSV)
        </Button>
      </Card>
      {downloadError ? <Notice tone="error">{downloadError}</Notice> : null}
    </div>
  )
}
