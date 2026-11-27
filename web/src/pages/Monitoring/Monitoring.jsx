import { useRef, useState } from 'react'
import Button from '../../components/Button/Button.jsx'
import Field from '../../components/Field/Field.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import LogbookTab from './LogbookTab.jsx'
import SlisTab from './SlisTab.jsx'
import SummaryTab from './SummaryTab.jsx'
import TestsTab from './TestsTab.jsx'
import { currentMonth } from './monitoring.js'
import styles from './Monitoring.module.css'

const TABS = [
  ['summary', 'Resumen'],
  ['slis', 'Indicadores'],
  ['tests', 'Pruebas'],
  ['logbook', 'Bitácora'],
]

export default function Monitoring() {
  const { session } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const [tab, setTab] = useState('summary')
  const [reload, setReload] = useState(0)
  const tabRefs = useRef([])

  function move(index, event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? TABS.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length
    setTab(TABS[next][0])
    tabRefs.current[next]?.focus()
  }

  const token = session?.token ?? ''

  return (
    <section className={styles.page}>
      <PageHeader
        actions={
          <>
            <Field className={styles.monthField} htmlFor="monitor-month" label="Mes (UTC-6)">
              <input
                id="monitor-month"
                onChange={(event) => setMonth(event.target.value || currentMonth())}
                type="month"
                value={month}
              />
            </Field>
            <Button onClick={() => setReload((value) => value + 1)} variant="secondary">
              Actualizar
            </Button>
          </>
        }
        description="Disponibilidad, indicadores SLI/SLO, pruebas y bitácora. Solo lectura, sin datos personales."
        eyebrow="ROOMLINK · ADMINISTRACIÓN"
        title="Monitoreo"
      />

      <div aria-label="Secciones de monitoreo" className={styles.tabs} role="tablist">
        {TABS.map(([id, label], index) => (
          <button
            aria-controls={`monitor-panel-${id}`}
            aria-selected={tab === id}
            className={styles.tab}
            id={`monitor-tab-${id}`}
            key={id}
            onClick={() => setTab(id)}
            onKeyDown={(event) => move(index, event)}
            ref={(element) => { tabRefs.current[index] = element }}
            role="tab"
            tabIndex={tab === id ? 0 : -1}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div
        aria-labelledby={`monitor-tab-${tab}`}
        className={styles.panel}
        id={`monitor-panel-${tab}`}
        role="tabpanel"
      >
        {tab === 'summary' ? <SummaryTab key={`${month}-${reload}`} month={month} token={token} /> : null}
        {tab === 'slis' ? <SlisTab key={`${month}-${reload}`} month={month} token={token} /> : null}
        {tab === 'tests' ? <TestsTab key={reload} token={token} /> : null}
        {tab === 'logbook' ? <LogbookTab key={`${month}-${reload}`} month={month} token={token} /> : null}
      </div>
    </section>
  )
}
