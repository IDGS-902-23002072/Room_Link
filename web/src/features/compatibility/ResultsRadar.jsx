import PropTypes from 'prop-types'
import styles from './ResultsRadar.module.css'

export default function ResultsRadar({ summary }) {
  const center = 100
  const radius = 68
  const angleFor = (index) => (-Math.PI / 2) + (index * Math.PI * 2) / summary.length
  const pointFor = (index, scale) => {
    const angle = angleFor(index)
    return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`
  }
  const resultPoints = summary
    .map(({ percentage }, index) => pointFor(index, percentage / 100))
    .join(' ')

  return (
    <section aria-label="Gráfica de preferencias por dimensión" className={styles.radar}>
      <svg aria-hidden="true" viewBox="0 0 200 200">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            className={styles.grid}
            key={scale}
            points={summary.map((_, index) => pointFor(index, scale)).join(' ')}
          />
        ))}
        {summary.map(({ category }, index) => (
          <line
            className={styles.axis}
            key={category}
            x1={center}
            x2={center + Math.cos(angleFor(index)) * radius}
            y1={center}
            y2={center + Math.sin(angleFor(index)) * radius}
          />
        ))}
        <polygon className={styles.result} points={resultPoints} />
        {summary.map(({ percentage }, index) => (
          <circle
            className={styles.point}
            key={index}
            cx={center + Math.cos(angleFor(index)) * radius * percentage / 100}
            cy={center + Math.sin(angleFor(index)) * radius * percentage / 100}
            r="3"
          />
        ))}
      </svg>
      <div className={styles.labels}>
        {summary.map(({ category, percentage }) => (
          <span key={category}>
            {category}
            <strong>{percentage}%</strong>
          </span>
        ))}
      </div>
    </section>
  )
}

ResultsRadar.propTypes = {
  summary: PropTypes.arrayOf(PropTypes.shape({
    category: PropTypes.string.isRequired,
    percentage: PropTypes.number.isRequired,
  })).isRequired,
}
