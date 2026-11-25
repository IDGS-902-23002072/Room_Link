import PropTypes from 'prop-types'
import styles from './Meter.module.css'

export default function Meter({ label, showEnds = false, value, className = '' }) {
  const percentage = Math.max(0, Math.min(100, Number(value) || 0))

  return (
    <div className={[styles.meter, className].filter(Boolean).join(' ')}>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percentage}
        className={styles.track}
        role="progressbar"
      >
        <span className={styles.fill} style={{ inlineSize: `${percentage}%` }} />
      </div>
      {showEnds ? (
        <div aria-hidden="true" className={styles.ends}>
          <span>1</span>
          <span>5</span>
        </div>
      ) : null}
    </div>
  )
}

Meter.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string.isRequired,
  showEnds: PropTypes.bool,
  value: PropTypes.number.isRequired,
}
