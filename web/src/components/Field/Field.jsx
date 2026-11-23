import PropTypes from 'prop-types'
import { Children, cloneElement } from 'react'
import styles from './Field.module.css'

export default function Field({
  children,
  className = '',
  error,
  hint,
  htmlFor,
  label,
  variant = 'block',
}) {
  const describedBy = error
    ? `${htmlFor}-error`
    : hint
      ? `${htmlFor}-hint`
      : undefined

  const control = cloneElement(Children.only(children), {
    id: htmlFor,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    className: [styles.control, children.props.className]
      .filter(Boolean)
      .join(' '),
  })

  return (
    <div className={[styles.field, styles[variant], className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {control}
      {error ? (
        <p className={styles.error} id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint} id={`${htmlFor}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

Field.propTypes = {
  children: PropTypes.element.isRequired,
  className: PropTypes.string,
  error: PropTypes.string,
  hint: PropTypes.string,
  htmlFor: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['block', 'inline']),
}
