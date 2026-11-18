import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  cargarSesionPersistida,
  obtenerSesion,
  suscribirSesion,
  type Sesion,
} from './sesion';

interface ValorContextoSesion {
  sesion: Sesion | null;
  cargando: boolean;
}

const ContextoSesion = createContext<ValorContextoSesion>({
  sesion: null,
  cargando: true,
});

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(obtenerSesion());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    cargarSesionPersistida().finally(() => {
      if (activo) setCargando(false);
    });
    const desuscribir = suscribirSesion(() => setSesion(obtenerSesion()));
    return () => {
      activo = false;
      desuscribir();
    };
  }, []);

  return (
    <ContextoSesion.Provider value={{ sesion, cargando }}>
      {children}
    </ContextoSesion.Provider>
  );
}

/** Hook para leer la sesión actual y si todavía está cargando desde el almacén. */
export function useSesion(): ValorContextoSesion {
  return useContext(ContextoSesion);
}
