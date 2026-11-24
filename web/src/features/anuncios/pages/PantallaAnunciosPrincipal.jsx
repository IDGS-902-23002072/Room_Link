
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../../hooks/useAuth.js'

import {
  obtenerMisPublicaciones,
  obtenerUrlPrimeraFoto,
} from '../services/anunciosService.js'

import FiltrosAnuncios from '../components/FiltrosAnuncios.jsx'
import TarjetaAnuncio from '../components/TarjetaAnuncio.jsx'
import BotonAnuncio from '../components/BotonAnuncio.jsx'

import '../styles/anuncios.css'

function PantallaAnunciosPrincipal() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [anuncios, setAnuncios] = useState([])
  const [filtroActivo, setFiltroActivo] = useState('todas')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargarAnuncios = useCallback(async () => {
    if (!session?.token || !session?.user?.id) {
      setError('No se encontró una sesión válida. Inicia sesión nuevamente.')
      setCargando(false)
      return
    }

    setCargando(true)
    setError('')

    try {
      const resultado = await obtenerMisPublicaciones(
        session.token,
        session.user.id
      )

      const anunciosFormateados = resultado.map((anuncio) => ({
        id: anuncio.id,
        titulo: anuncio.title,
        renta: anuncio.monthlyRent,
        estado: anuncio.status,
        ubicacion: '',
        foto: anuncio.photosCount > 0
          ? obtenerUrlPrimeraFoto(anuncio.id)
          : null,
      }))

      setAnuncios(anunciosFormateados)
    } catch (err) {
      setError(err.message || 'No fue posible cargar tus publicaciones.')
    } finally {
      setCargando(false)
    }
  }, [session?.token, session?.user?.id])

  useEffect(() => {
    let activo = true

    async function cargar() {
      if (!session?.token || !session?.user?.id) {
        setError('No se encontró una sesión válida. Inicia sesión nuevamente.')
        setCargando(false)
        return
      }

      setCargando(true)
      setError('')

      try {
        const resultado = await obtenerMisPublicaciones(
          session.token,
          session.user.id
        )

        if (!activo) return

        const anunciosFormateados = resultado.map((anuncio) => ({
          id: anuncio.id,
          titulo: anuncio.title,
          renta: anuncio.monthlyRent,
          estado: anuncio.status,
          ubicacion: '',
          foto: anuncio.photosCount > 0
            ? obtenerUrlPrimeraFoto(anuncio.id)
            : null,
        }))

        setAnuncios(anunciosFormateados)
      } catch (err) {
        if (activo) {
          setError(err.message || 'No fue posible cargar tus publicaciones.')
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargar()

    return () => {
      activo = false
    }
  }, [session?.token, session?.user?.id])

  const anunciosFiltrados = useMemo(() => {
    if (filtroActivo === 'todas') return anuncios

    return anuncios.filter(
      (anuncio) => anuncio.estado === filtroActivo
    )
  }, [anuncios, filtroActivo])

  const cantidades = useMemo(() => ({
    todas: anuncios.length,
    published: anuncios.filter(
      (anuncio) => anuncio.estado === 'published'
    ).length,
    paused: anuncios.filter(
      (anuncio) => anuncio.estado === 'paused'
    ).length,
    closed: anuncios.filter(
      (anuncio) => anuncio.estado === 'closed'
    ).length,
  }), [anuncios])

  function verAnuncio(id) {
    navigate(`/anuncios/${id}`)
  }

  function editarAnuncio(id) {
    navigate(`/anuncios/${id}/editar`)
  }

  function administrarAnuncio(id) {
    navigate(`/anuncios/${id}/fotos`)
  }

  return (
    <main className="anuncios-contenedor">
      <header className="anuncios-encabezado">
        <div>
          <h1 className="anuncios-titulo">Mis anuncios</h1>
          <p className="anuncios-subtitulo">
            Administra las habitaciones que has publicado en RoomLink.
          </p>
        </div>

        <BotonAnuncio
          tipo="principal"
          onClick={() => navigate('/anuncios/publicar')}
        >
          + Publicar habitación
        </BotonAnuncio>
      </header>

      <section className="anuncios-resumen">
        <div>
          <span className="anuncios-resumen__numero">
            {cantidades.todas}
          </span>
          <span className="anuncios-resumen__texto">
            Publicaciones registradas
          </span>
        </div>
      </section>

      <section className="anuncios-listado">
        <div className="anuncios-listado__encabezado">
          <div>
            <h2>Tu inventario de habitaciones</h2>
            <p>Consulta el estado de cada publicación.</p>
          </div>

          <BotonAnuncio
            tipo="secundario"
            onClick={cargarAnuncios}
            disabled={cargando}
          >
            Actualizar
          </BotonAnuncio>
        </div>

        <FiltrosAnuncios
          filtroActivo={filtroActivo}
          onCambiarFiltro={setFiltroActivo}
          cantidades={cantidades}
        />

        {cargando && (
          <div className="anuncios-mensaje">
            <span className="anuncios-cargando__indicador" />
            <p>Cargando tus publicaciones...</p>
          </div>
        )}

        {!cargando && error && (
          <div className="anuncios-mensaje anuncios-mensaje--error">
            <h3>No pudimos cargar tus anuncios</h3>
            <p>{error}</p>
            <BotonAnuncio
              tipo="secundario"
              onClick={cargarAnuncios}
            >
              Intentar nuevamente
            </BotonAnuncio>
          </div>
        )}

        {!cargando && !error && anuncios.length === 0 && (
          <div className="anuncios-vacio">
            <div className="anuncios-vacio__icono">⌂</div>
            <h3>Aún no tienes habitaciones publicadas</h3>
            <p>
              Cuando registres una habitación, aparecerá aquí para que
              puedas administrarla.
            </p>
            <BotonAnuncio
              tipo="principal"
              onClick={() => navigate('/anuncios/publicar')}
            >
              Publicar mi primera habitación
            </BotonAnuncio>
          </div>
        )}

        {!cargando && !error && anuncios.length > 0 &&
          anunciosFiltrados.length === 0 && (
            <div className="anuncios-vacio">
              <h3>No hay publicaciones en esta categoría</h3>
              <p>Prueba seleccionando otro filtro.</p>
            </div>
          )}

        {!cargando && !error && anunciosFiltrados.length > 0 && (
          <div className="anuncios-lista">
            {anunciosFiltrados.map((anuncio) => (
              <TarjetaAnuncio
                key={anuncio.id}
                anuncio={anuncio}
                onVer={verAnuncio}
                onEditar={editarAnuncio}
                onAdministrar={administrarAnuncio}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default PantallaAnunciosPrincipal
