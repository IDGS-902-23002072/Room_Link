import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

export function AppLink({ href, onClick, children, ...props }) {
  return (
    <Link to={href} onClick={onClick} {...props}>
      {children}
    </Link>
  )
}

AppLink.propTypes = {
  children: PropTypes.node.isRequired,
  href: PropTypes.string.isRequired,
  onClick: PropTypes.func,
}
