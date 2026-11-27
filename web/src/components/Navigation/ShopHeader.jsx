import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Brand } from '../../features/cesar-ui.jsx'
import Icon from '../Icon.jsx'
import interior from '../../assets/roomlink-interior.webp'
import './shop-header.css'

const sections = [
  { title: 'Habitaciones', intro: 'Un espacio que se sienta tuyo.', links: [
    ['/explorar', 'Explorar habitaciones', 'Descubre tu próximo hogar', 'home'],
    ['/recomendados', 'Elegidas para ti', 'Espacios según tu compatibilidad', 'spark'],
    ['/habitaciones', 'Todas las habitaciones', 'Compara tus opciones', 'search'],
  ] },
  { title: 'Roomies', intro: 'Compartir empieza por conectar.', links: [
    ['/buscar', 'Encuentra roomies', 'Conoce personas para tu nueva etapa', 'people'],
    ['/cuestionario', 'Tu compatibilidad', 'Cuéntanos cómo te gusta vivir', 'test'],
    ['/conexiones', 'Tus conexiones', 'Retoma una buena conversación', 'messages'],
  ] },
  { title: 'Mi espacio', intro: 'Todo lo tuyo, en un mismo lugar.', links: [
    ['/mis-postulaciones', 'Mis postulaciones', 'Sigue cada paso de tu búsqueda', 'test'],
    ['/acuerdos', 'Mis acuerdos', 'Consulta los detalles de tu estancia', 'home'],
    ['/mis-roomies', 'Mis roomies', 'Organiza la vida en casa', 'people'],
  ] },
  { title: 'Publicar', intro: 'Tu espacio puede ser su próximo hogar.', links: [
    ['/anuncios/publicar', 'Publicar habitación', 'Presenta tu espacio a la comunidad', 'plus'],
    ['/anuncios', 'Mis anuncios', 'Gestiona tus publicaciones', 'home'],
    ['/perfil/arrendador', 'Ser arrendador', 'Prepara tu perfil para recibir roomies', 'profile'],
  ] },
]

export default function ShopHeader({ explore, openSidebar, toggleRef, inert, sidebarOpen }) {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(() => window.scrollY > 32)
  const [active, setActive] = useState(null)
  const timer = useRef(null)
  const triggers = useRef([])
  const header = useRef(null)
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 32)
    window.addEventListener('scroll', scroll, { passive: true })
    return () => window.removeEventListener('scroll', scroll)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  // Route changes remount this component through the shell's location key.
  const dismiss = () => { clearTimeout(timer.current); setActive(null) }
  const select = (index) => { clearTimeout(timer.current); setActive(index) }
  const transparent = explore && !scrolled && active === null
  return <>
    {active !== null && <button className="shop-backdrop" aria-label="Cerrar vista previa" tabIndex={-1} onClick={dismiss} />}
    <header ref={header} className={`shop-header${transparent ? ' shop-header-transparent' : ''}`} inert={inert}
      onPointerEnter={() => clearTimeout(timer.current)}
      onPointerLeave={() => { if (!header.current.contains(document.activeElement)) timer.current = setTimeout(dismiss, 180) }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) dismiss() }}
      onKeyDown={(event) => { if (event.key === 'Escape' && active !== null) { const index = active; dismiss(); triggers.current[index]?.focus() } }}>
      <div className="shop-header-row">
        <Brand />
        <nav className="shop-categories" aria-label="Descubrir RoomLink">
          {sections.map((section, index) => <button key={section.title} ref={(node) => { triggers.current[index] = node }}
            className={active === index ? 'selected' : ''} aria-expanded={active === index} aria-controls={`shop-preview-${index}`}
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') select(index) }}
            onClick={() => active === index ? dismiss() : select(index)}>{section.title}</button>)}
        </nav>
        <div className="shop-actions">
          <NavLink to="/explorar#room-results" aria-label="Buscar habitaciones" title="Buscar habitaciones" onClick={dismiss}><Icon name="search" /></NavLink>
          <NavLink to="/perfil" aria-label="Mi perfil" title="Mi perfil" onClick={dismiss}><Icon name="profile" /></NavLink>
          <button ref={toggleRef} className="shop-menu-trigger" aria-label="Abrir menú" aria-controls="roomlink-sidebar" aria-expanded={sidebarOpen} onClick={() => { dismiss(); openSidebar() }}><span>Menú</span><Icon name="menu" size={20} /></button>
        </div>
      </div>
      {sections.map((section, index) => <nav key={section.title} id={`shop-preview-${index}`} className="shop-preview" aria-label={section.title} hidden={active !== index}>
        <div className="shop-preview-intro"><img src={interior} alt="" /><p>{section.intro}</p></div>
        {section.links.map(([to, title, description, icon]) => <NavLink key={to} to={to} onClick={dismiss} className="shop-preview-card" aria-current={location.pathname === to ? 'page' : undefined}>
          <span className="shop-preview-icon"><Icon name={icon} size={42} /></span><strong>{title}</strong><span>{description}</span><span className="shop-preview-arrow" aria-hidden="true">↗</span>
        </NavLink>)}
      </nav>)}
    </header>
  </>
}
