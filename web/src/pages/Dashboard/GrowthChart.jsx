import PropTypes from 'prop-types'
import { formatNumber } from './format.js'
import styles from './Dashboard.module.css'

export default function GrowthChart({ data }) {
  const maximum = Math.max(1, ...data.map(({ total }) => total))
  const points = data.map(({ total }, index) => {
    const x = data.length <= 1 ? 400 : 12 + (index * 776) / (data.length - 1)
    const y = 185 - (total / maximum) * 150
    return { x, y, total }
  })

  return (
    <section
      aria-label="Crecimiento mensual de usuarios"
      className={`${styles.chart} ${styles.growthChart}`}
      id="reportes"
    >
      <div className={styles.chartHeading}>
        <div>
          <h2>Crecimiento de usuarios</h2>
          <p>Registros nuevos por mes en el periodo seleccionado</p>
        </div>
        <span className={styles.chartTotal}>
          {formatNumber(data.reduce((sum, item) => sum + item.total, 0))}
        </span>
      </div>

      <svg
        aria-label={`Crecimiento mensual: ${data.map(({ month, total }) => `${month}, ${total}`).join('; ')}`}
        className={styles.lineChart}
        role="img"
        viewBox="0 0 800 220"
      >
        {[35, 85, 135, 185].map((y) => (
          <line className={styles.gridline} key={y} x1="0" x2="800" y1={y} y2={y} />
        ))}
        {points.length > 1 && (
          <polyline
            className={styles.line}
            points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
          />
        )}
        {points.map(({ x, y, total }, index) => (
          <circle
            aria-label={`${data[index].month}: ${formatNumber(total)}`}
            className={styles.dot}
            key={data[index].month}
            cx={x}
            cy={y}
            r="4"
          />
        ))}
      </svg>

      <div className={styles.lineLabels}>
        {data.map(({ month }) => (
          <span key={month}>
            {new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' }).format(
              new Date(`${month}-01T00:00:00.000Z`),
            )}
          </span>
        ))}
      </div>
    </section>
  )
}

GrowthChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    month: PropTypes.string.isRequired,
    total: PropTypes.number.isRequired,
  })).isRequired,
}
