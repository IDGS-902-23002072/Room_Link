import PropTypes from 'prop-types'
import styles from './PageHeader.module.css'

export default function PageHeader({ actions, description, eyebrow, title }) {
  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  )
}

PageHeader.propTypes = {
  actions: PropTypes.node,
  description: PropTypes.node,
  eyebrow: PropTypes.string,
  title: PropTypes.string.isRequired,
}
