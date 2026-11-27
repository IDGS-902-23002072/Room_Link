import { NavLink, Outlet } from 'react-router-dom'
import './workspace.css'
import LoadingState from '../../components/LoadingState/LoadingState.jsx'

const sections = {
  profile: ['Perfil de usuario', [
    ['/perfil', 'Mi perfil'], ['/perfil/fotos', 'Fotos e identidad'],
    ['/perfil/cuenta', 'Preferencias'], ['/perfil/arrendador', 'Ser arrendador'],
  ]],
  search: ['Búsqueda avanzada', [
    ['/buscar', 'Filtros generales'], ['/buscar/habitos', 'Hábitos y compatibilidad'],
    ['/buscar/guardadas', 'Búsquedas guardadas'],
  ]],
  agreements: ['Acuerdos de convivencia', [
    ['/acuerdos/crear', 'Crear acuerdo'], ['/acuerdos/revisar', 'Revisar y aceptar'],
    ['/acuerdos', 'Acuerdos vigentes'],
  ]],
}

export function Workspace({ module }) {
  const [title, links] = sections[module]
  return (
    <div className="room-workspace">
      <aside className="room-sidebar">
        <h2>{title}</h2>
        <nav aria-label={title}>
          {links.map(([path, label]) => (
            <NavLink end={path !== '/acuerdos/revisar'} key={path} to={path}>{label}</NavLink>
          ))}
        </nav>
      </aside>
      <div className="room-workspace-content"><Outlet /></div>
    </div>
  )
}

export function Heading({ title, children, action }) {
  return (
    <header className="room-heading">
      <div><h1>{title}</h1><p className="muted">{children}</p></div>
      {action}
    </header>
  )
}

export function Panel({ title, children }) {
  return <section className="room-panel">{title && <h2>{title}</h2>}{children}</section>
}

export function Feedback({ error, children }) {
  if (error) return <p className="feature-feedback feature-error" role="alert">{error}</p>
  return children ? <p className="room-note" role="status">{children}</p> : null
}

export function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="room-toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} role="switch" type="checkbox" />
    </label>
  )
}

export function Avatar({ name, src }) {
  return src ? <img alt="" className="room-avatar" src={src} /> : (
    <span aria-hidden="true" className="room-avatar">
      {name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'}
    </span>
  )
}

export function ResourceStatus({ resource, label }) {
  if (resource.loading) return <LoadingState label={label} />
  if (!resource.error) return null
  return <div className="room-stack"><Feedback error={resource.error} /><button className="button button-subtle" onClick={resource.refresh} type="button">Reintentar</button></div>
}
