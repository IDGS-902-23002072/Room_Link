import PropTypes from 'prop-types'
import styles from './EmptyState.module.css'

export default function EmptyState({ action, description, icon, title }) {
  return (
    <div className={styles.empty}>
      <span aria-hidden="true" className={styles.icon}>
        {icon ?? (
          <svg viewBox="0 0 48 48">
            <path d="M10 22 24 10l14 12" />
            <path d="M15 20v17h18V20" />
            <path d="M21 37V27h6v10" />
          </svg>
        )}
      </span>
      <h2 className={styles.title}>{title}</h2>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}

EmptyState.propTypes = {
  action: PropTypes.node,
  description: PropTypes.node,
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
}
