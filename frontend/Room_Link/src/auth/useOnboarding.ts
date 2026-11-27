// Onboarding obligatorio (bugs #0 y #12): un usuario recién registrado debe
// completar su perfil y la encuesta de compatibilidad antes de usar la app.
// Este hook consulta ambos estados; ante un error de red NO bloquea (asume
// completo) para no dejar al usuario encerrado por una caída transitoria.

import { useCallback, useEffect, useState } from 'react';

import { obtenerTestCompatibilidad } from '@/modulos/compatibilidad/api';
import { obtenerPerfil, PerfilNoEncontrado } from '@/modulos/perfil/api';

export interface EstadoOnboarding {
  cargando: boolean;
  tienePerfil: boolean;
  tieneEncuesta: boolean;
  completo: boolean;
  refrescar: () => void;
}

async function consultarOnboarding() {
  const [perfil, encuesta] = await Promise.allSettled([
    obtenerPerfil(),
    obtenerTestCompatibilidad(),
  ]);
  return {
    cargando: false,
    tienePerfil: perfil.status === 'fulfilled' || !(perfil.reason instanceof PerfilNoEncontrado),
    tieneEncuesta: encuesta.status === 'rejected' || encuesta.value.answers != null,
  };
}

export function useOnboarding(): EstadoOnboarding {
  const [estado, setEstado] = useState({
    cargando: true,
    tienePerfil: false,
    tieneEncuesta: false,
  });

  const refrescar = useCallback(() => {
    setEstado((actual) => ({ ...actual, cargando: true }));
    void consultarOnboarding().then(setEstado);
  }, []);

  useEffect(() => {
    let activo = true;
    void consultarOnboarding().then((resultado) => {
      if (activo) setEstado(resultado);
    });
    return () => { activo = false; };
  }, []);

  return {
    ...estado,
    completo: estado.tienePerfil && estado.tieneEncuesta,
    refrescar,
  };
}
