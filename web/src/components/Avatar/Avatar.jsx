import PropTypes from 'prop-types'
import styles from './Avatar.module.css'

const SIZES = {
  sm: 36,
  md: 44,
  lg: 96,
}

function initialsFrom(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase()
}

export default function Avatar({ src, name, size = 'md', className = '' }) {
  const classes = [styles.avatar, styles[size], className].filter(Boolean).join(' ')

  if (src) {
    return (
      <img
        alt=""
        className={classes}
        height={SIZES[size]}
        loading="lazy"
        src={src}
        width={SIZES[size]}
      />
    )
  }

  return (
    <span aria-hidden="true" className={classes}>
      {initialsFrom(name)}
    </span>
  )
}

Avatar.propTypes = {
  className: PropTypes.string,
  name: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  src: PropTypes.string,
}
