import PropTypes from 'prop-types'
import styles from './BrandMark.module.css'

export function BrandSymbol() {
  return (
    <svg aria-hidden="true" className={styles.symbol} viewBox="0 0 40 40">
      <rect className={styles.frame} height="38" rx="12" width="38" x="1" y="1" />
      <path className={styles.roof} d="M11.5 21 20 13.5 28.5 21" />
      <path className={styles.walls} d="M14.5 20v7.5h11V20" />
      <circle className={styles.sun} cx="29" cy="12" r="3.5" />
    </svg>
  )
}

export default function BrandMark({ variant = 'full' }) {
  return (
    <span className={[styles.mark, styles[variant]].filter(Boolean).join(' ')}>
      <BrandSymbol />
      {variant === 'full' ? <span className={styles.wordmark}>RoomLink</span> : null}
    </span>
  )
}

BrandMark.propTypes = {
  variant: PropTypes.oneOf(['full', 'mark']),
}
