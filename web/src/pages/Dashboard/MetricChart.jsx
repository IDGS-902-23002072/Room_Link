import PropTypes from 'prop-types'
import { formatNumber } from './format.js'
import styles from './Dashboard.module.css'

export default function MetricChart({ data, description, title }) {
  const max = Math.max(1, ...data.map(({ total }) => total))

  return (
    <section className={styles.chart} aria-label={title}>
      <div className={styles.chartHeading}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className={styles.chartTotal}>
          {formatNumber(data.reduce((sum, item) => sum + item.total, 0))}
        </span>
      </div>
      <div className={styles.bars} role="list">
        {data.map(({ month, total }) => {
          const height = total === 0 ? 0 : Math.max(7, (total / max) * 100)
          const label = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' }).format(
            new Date(`${month}-01T00:00:00.000Z`),
          )
          return (
            <div className={styles.barColumn} key={month} role="listitem">
              <span className={styles.barValue}>{formatNumber(total)}</span>
              <div className={styles.barTrack}>
                <div
                  aria-label={`${label}: ${formatNumber(total)}`}
                  className={styles.bar}
                  role="img"
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className={styles.barLabel}>{label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

MetricChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    month: PropTypes.string.isRequired,
    total: PropTypes.number.isRequired,
  })).isRequired,
  description: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
}
