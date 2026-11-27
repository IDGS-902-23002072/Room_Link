import PropTypes from 'prop-types'
import styles from './Notice.module.css'

export default function Notice({
  children,
  className = '',
  role,
  title,
  tone = 'info',
}) {
  const resolvedRole = role ?? (tone === 'error' ? 'alert' : 'status')

  return (
    <div
      className={[styles.notice, styles[tone], className].filter(Boolean).join(' ')}
      role={resolvedRole}
    >
      {title ? <strong className={styles.title}>{title}</strong> : null}
      <div>{children}</div>
    </div>
  )
}

Notice.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  role: PropTypes.string,
  title: PropTypes.string,
  tone: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
}
