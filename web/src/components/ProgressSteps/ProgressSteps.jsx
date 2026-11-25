import PropTypes from 'prop-types'
import styles from './ProgressSteps.module.css'

export default function ProgressSteps({
  answered,
  className = '',
  current,
  label = 'Progreso',
  steps,
  variant = 'compact',
}) {
  return (
    <ol
      aria-label={label}
      className={[styles.steps, styles[variant], className].filter(Boolean).join(' ')}
    >
      {steps.map(({ id, title }, index) => {
        const done = answered[id] !== undefined && index !== current
        const state = index === current ? styles.current : done ? styles.done : ''
        return (
          <li
            aria-current={index === current ? 'step' : undefined}
            className={[styles.step, state].filter(Boolean).join(' ')}
            key={id}
          >
            <span aria-hidden="true" className={styles.bullet}>
              {done ? '✓' : index + 1}
            </span>
            <span className={variant === 'list' ? styles.title : 'sr-only'}>
              {title}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

ProgressSteps.propTypes = {
  answered: PropTypes.objectOf(PropTypes.number).isRequired,
  className: PropTypes.string,
  current: PropTypes.number.isRequired,
  label: PropTypes.string,
  steps: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  })).isRequired,
  variant: PropTypes.oneOf(['compact', 'list']),
}
