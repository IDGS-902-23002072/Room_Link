import PropTypes from 'prop-types'
import { AppLink } from '../AppLink.jsx'
import styles from './Button.module.css'

export default function Button({
  children,
  className = '',
  href,
  loading = false,
  disabled = false,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}) {
  const busy = loading || props['aria-busy'] === true
  const content = <>{busy && <span className={styles.spinner} aria-hidden="true" />}{children}</>
  const classes = [styles.button, styles[size], styles[variant], className]
    .filter(Boolean)
    .join(' ')

  if (href && !disabled && !busy) {
    return (
      <AppLink className={classes} href={href} {...props}>
        {content}
      </AppLink>
    )
  }

  return (
    <button className={classes} type={type} {...props} disabled={disabled || busy} aria-busy={busy || undefined}>
      {content}
    </button>
  )
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  href: PropTypes.string,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['md', 'sm']),
  type: PropTypes.oneOf(['button', 'reset', 'submit']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'quiet', 'danger']),
}
