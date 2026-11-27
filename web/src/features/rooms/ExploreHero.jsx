import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './RoomFeed.module.css'

// Gustavo Fring / Pexels. See public/media-sources.md.
const videoUrl = 'https://videos.pexels.com/video-files/7424438/7424438-uhd_3840_2160_30fps.mp4'

export default function ExploreHero() {
  const hero = useRef(null)
  const video = useRef(null)
  const hasPlayed = useRef(false)
  const [slide, setSlide] = useState('image')
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [visibleFrame, setVisibleFrame] = useState(false)
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(() => !document.hidden)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const running = !paused && !reducedMotion && inView && tabVisible && !failed

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReducedMotion(media.matches)
    const visibility = () => setTabVisible(!document.hidden)
    media.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 })
    observer.observe(hero.current)
    return () => { observer.disconnect(); media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility) }
  }, [])

  useEffect(() => {
    if (!running || !ready || slide !== 'image') return
    const timer = setTimeout(() => setSlide('video'), hasPlayed.current ? 7000 : 1800)
    return () => clearTimeout(timer)
  }, [running, ready, slide])

  useEffect(() => {
    const player = video.current
    if (!player) return
    if (!running || slide !== 'video') { player.pause(); return }
    let cancelled = false
    player.play().catch(() => {
      if (!cancelled) { setPaused(true); setSlide('image'); setVisibleFrame(false) }
    })
    return () => { cancelled = true; player.pause() }
  }, [running, slide])

  function selectSlide(next) {
    if (next === 'image') {
      video.current?.pause()
      if (video.current) video.current.currentTime = 0
      setVisibleFrame(false)
    }
    setSlide(next)
  }

  function togglePlayback() {
    if (paused || reducedMotion) { setReducedMotion(false); setPaused(false) }
    else setPaused(true)
  }

  return <header ref={hero} className={styles.hero} aria-roledescription="carrusel" aria-label="Bienvenido a RoomLink">
    <img className={styles.heroImage} src="/explore-interior.png" alt="" fetchPriority="high" />
    {!failed && <video ref={video} className={`${styles.heroImage} ${styles.heroVideo}`} style={{ opacity: slide === 'video' && visibleFrame ? 1 : 0 }}
      src={videoUrl} muted playsInline preload="auto" aria-hidden="true" tabIndex={-1}
      onCanPlay={() => setReady(true)}
      onPlaying={() => { hasPlayed.current = true; setVisibleFrame(true) }}
      onEnded={() => selectSlide('image')}
      onError={() => { setFailed(true); setSlide('image'); setVisibleFrame(false) }} />}
    <div className={styles.heroShade} />
    <div className={styles.heroContent}>
      <p className={styles.heroEyebrow}>TU ESPACIO. TU GENTE.</p>
      <h1>Encuentra tu habitación.</h1>
      <p>Un nuevo lugar. Una nueva forma de compartir.</p>
      <div className={styles.heroActions}>
        <a className={styles.heroAction} href="#room-results">Explorar habitaciones</a>
        <Link className={styles.heroSecondary} to="/buscar">Encuentra tu roomie</Link>
      </div>
    </div>
    <div className={`${styles.heroFooter} ${styles.carouselFooter}`}>
      <span>Tu próxima etapa empieza aquí</span>
      {!failed ? <>
        <div className={styles.carouselDots} role="group" aria-label="Elegir portada">
          <button onClick={() => selectSlide('image')} aria-label="Mostrar imagen" aria-pressed={slide === 'image'} />
          <button onClick={() => selectSlide('video')} disabled={!ready} aria-label="Mostrar video" aria-pressed={slide === 'video'} />
        </div>
        <button className={styles.videoControl} onClick={togglePlayback} aria-pressed={paused || reducedMotion}>
          <span aria-hidden="true">{paused || reducedMotion ? '▷' : 'Ⅱ'}</span>
          {paused || reducedMotion ? 'Reanudar carrusel' : 'Pausar carrusel'}
        </button>
      </> : <span role="status">El video no está disponible. Disfruta la portada.</span>}
    </div>
  </header>
}
