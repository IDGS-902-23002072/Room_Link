import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useRoomLinkQuery } from '../../hooks/useRoomLinkQuery.js'
import { Brand } from '../../features/cesar-ui.jsx'
import Icon from '../Icon.jsx'
import './navigation.css'
import ShopHeader from './ShopHeader.jsx'

const quickLinks = [
  ['/perfil', 'profile', 'Mi perfil'], ['/mensajes', 'messages', 'Mensajes'],
  ['/notificaciones', 'bell', 'Avisos'], ['/cuestionario', 'test', 'Mi test'],
  ['/conexiones', 'people', 'Conexiones'], ['/perfil/cuenta', 'settings', 'Ajustes'],
]

export default function AppShell() {
  const { session, logout } = useAuth()
  const location = useLocation()
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem('roomlink.sidebar.pinned.v2') === 'true' } catch { return false }
  })
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1100px)').matches)
  const [expanded, setExpanded] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const toggle = useRef(null)
  const sidebar = useRef(null)
  const closeButton = useRef(null)
  const closeTimer = useRef(null)
  const fixed = desktop && pinned
  const open = fixed || expanded
  const explore = ['/', '/explorar'].includes(location.pathname)
  const isAdmin = session.user.roles?.includes('admin')
  const notifications = useRoomLinkQuery('/api/v1/notifications?limit=1', session.token, location.pathname)
  const unread = notifications.data?.unreadCount ?? 0

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)')
    const change = () => { setDesktop(media.matches); setExpanded(false) }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
      else window.scrollTo({ top: 0, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(id)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!expanded || desktop) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [expanded, desktop])
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  function close(restoreFocus = true) {
    clearTimeout(closeTimer.current)
    setExpanded(false)
    if (restoreFocus) toggle.current?.focus()
  }

  function show(focus = false) {
    clearTimeout(closeTimer.current)
    setExpanded(true)
    if (focus) requestAnimationFrame(() => closeButton.current?.focus())
  }

  function pin() {
    const next = !pinned
    setPinned(next)
    setExpanded(false)
    try { localStorage.setItem('roomlink.sidebar.pinned.v2', String(next)) } catch { /* Optional preference. */ }
    if (!next) requestAnimationFrame(() => toggle.current?.focus())
  }

  function keys(event) {
    if (event.key === 'Escape' && expanded && !fixed) { event.preventDefault(); close() }
    if (event.key !== 'Tab' || desktop || !expanded) return
    const targets = [...sidebar.current.querySelectorAll('a[href], button:not(:disabled)')].filter((node) => node.getClientRects().length)
    const first = targets[0], last = targets.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  async function signOut() {
    setSigningOut(true)
    try { await logout() } catch { /* AuthProvider clears the local session. */ }
    finally { setSigningOut(false) }
  }

  function link(to, label, icon) {
    return <NavLink to={to} onClick={() => { if (!fixed) close(false) }} className="sidebar-link"><Icon name={icon} /><span>{label}</span></NavLink>
  }

  return <div className={`navigation-shell${fixed ? ' sidebar-pinned' : ''}${explore ? ' shell-explore' : ''}`} onKeyDown={keys}>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <ShopHeader key={location.pathname + location.hash} explore={explore} toggleRef={toggle} openSidebar={() => fixed ? pin() : expanded ? close() : show(true)} sidebarOpen={open} inert={expanded && !desktop} />
    {!fixed && desktop && <button className="sidebar-edge" aria-label="Mostrar navegación" onPointerEnter={(event) => { if (event.pointerType === 'mouse') show() }} onClick={() => show(true)}><Icon name="menu" size={17} /></button>}
    {expanded && !fixed && <button className="sidebar-scrim" tabIndex={-1} aria-label="Cerrar navegación" onClick={() => close()} />}
    <aside id="roomlink-sidebar" className={`roomlink-sidebar${open ? ' sidebar-expanded' : ''}`} ref={sidebar} inert={!open}
      onPointerEnter={() => clearTimeout(closeTimer.current)}
      onPointerLeave={() => { if (desktop && !fixed && !sidebar.current.contains(document.activeElement)) closeTimer.current = setTimeout(() => close(false), 280) }}>
      <div className="sidebar-brand"><Brand /><button ref={closeButton} className="icon-control" onClick={desktop ? pin : () => close()} aria-label={desktop ? (pinned ? 'Ocultar barra lateral' : 'Fijar barra lateral') : 'Cerrar navegación'} title={desktop ? (pinned ? 'Ocultar barra lateral' : 'Fijar barra lateral') : 'Cerrar navegación'} aria-pressed={desktop ? pinned : undefined}><Icon name={desktop ? 'pin' : 'close'} size={18} /></button></div>
      <nav className="sidebar-shortcuts" aria-label="Accesos rápidos">
        {quickLinks.map(([to, icon, label]) => <NavLink key={to} to={to} end={to === '/perfil'} className="sidebar-shortcut" title={label} aria-label={icon === 'bell' && unread ? `${label}: ${unread} sin leer` : label} onClick={() => { if (!fixed) close(false) }}>
          <span className="shortcut-icon"><Icon name={icon} />{icon === 'bell' && unread > 0 && <span className="shortcut-count">{unread > 9 ? '9+' : unread}</span>}</span><span>{label}</span>
        </NavLink>)}
      </nav>
      <nav className="sidebar-sections" aria-label="Navegación principal">
        <p className="sidebar-label">DESCUBRIR</p>
        {link('/explorar', 'Encuentra tu habitación', 'home')}
        {link('/recomendados', 'Para ti', 'spark')}
        {link('/buscar', 'Buscar roomies', 'search')}
        {link('/habitaciones', 'Todas las habitaciones', 'home')}
        <p className="sidebar-label">MI ESPACIO</p>
        {link('/mis-postulaciones', 'Mis postulaciones', 'test')}
        {link('/anuncios', 'Mis anuncios', 'home')}
        {session.user.roles?.includes('host') && link('/anfitrion', 'Gestionar habitaciones', 'settings')}
        {link('/acuerdos', 'Acuerdos', 'test')}
        {link('/mis-roomies', 'Mis roomies', 'people')}
        {isAdmin && <><p className="sidebar-label">ADMINISTRACIÓN</p>{link('/admin/moderacion', 'Moderación', 'test')}{link('/admin/dashboard', 'Dashboard', 'settings')}{link('/admin/identidad', 'Identidad', 'profile')}{link('/admin/bitacora', 'Bitácora', 'test')}</>}
        <NavLink to="/denunciar" className="sidebar-help" onClick={() => { if (!fixed) close(false) }}>Reportar un anuncio</NavLink>
      </nav>
      <div className="sidebar-bottom">
        <NavLink className="button button-mint sidebar-publish" to="/anuncios/publicar" onClick={() => { if (!fixed) close(false) }}><Icon name="plus" size={18} />Publicar habitación</NavLink>
        <div className="sidebar-account"><span title={session.user.email}>{session.user.email}</span><button className="icon-control" disabled={signingOut} aria-busy={signingOut} onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión"><Icon name="logout" size={18} /></button></div>
      </div>
    </aside>
    <main id="contenido" className="shell-content" tabIndex={-1} inert={expanded && !desktop}><Outlet /></main>
  </div>
}
