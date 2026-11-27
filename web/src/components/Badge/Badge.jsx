import PropTypes from 'prop-types'
import styles from './Badge.module.css'

export default function Badge({ children, className = '', tone = 'neutral' }) {
  return (
    <span className={[styles.badge, styles[tone], className].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  tone: PropTypes.oneOf(['neutral', 'accent', 'success', 'warning', 'info', 'danger']),
}
