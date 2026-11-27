import PropTypes from 'prop-types'
import styles from './Card.module.css'

export default function Card({ as: Component = 'section', children, className = '', ...props }) {
  return (
    <Component className={[styles.card, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </Component>
  )
}

Card.propTypes = {
  as: PropTypes.elementType,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
}
