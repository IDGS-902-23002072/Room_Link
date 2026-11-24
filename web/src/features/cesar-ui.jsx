import { Link } from 'react-router-dom'

export function Brand({ to = '/explorar' }) {
  return (
    <Link className="brand" to={to}>
      <img src="/favicon.svg" width="39" height="39" alt="" />
      <span>RoomLink</span>
    </Link>
  )
}

export function FeatureHeading({ title, description, children }) {
  return (
    <header className="feature-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  )
}

export function FeatureNotice({ error, retry, children }) {
  if (error) {
    return (
      <div className="notice feature-error" role="alert">
        {error}
        {retry && <button type="button" className="button button-mint" onClick={retry}>Reintentar</button>}
      </div>
    )
  }
  return <p className="feature-empty" role="status">{children}</p>
}
