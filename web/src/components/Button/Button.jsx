import PropTypes from 'prop-types'
import { AppLink } from '../AppLink.jsx'
import styles from './Button.module.css'

export default function Button({
  children,
  className = '',
  href,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}) {
  const classes = [styles.button, styles[size], styles[variant], className]
    .filter(Boolean)
    .join(' ')

  if (href) {
    return (
      <AppLink className={classes} href={href} {...props}>
        {children}
      </AppLink>
    )
  }

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  )
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  href: PropTypes.string,
  size: PropTypes.oneOf(['md', 'sm']),
  type: PropTypes.oneOf(['button', 'reset', 'submit']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'quiet']),
}
