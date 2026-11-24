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

export function useOnboarding(): EstadoOnboarding {
  const [estado, setEstado] = useState({
    cargando: true,
    tienePerfil: false,
    tieneEncuesta: false,
  });

  const comprobar = useCallback(async () => {
    setEstado((e) => ({ ...e, cargando: true }));
    let tienePerfil = true;
    let tieneEncuesta = true;
    try {
      await obtenerPerfil();
      tienePerfil = true;
    } catch (e) {
      // Solo un 404 explícito significa "sin perfil"; cualquier otro error
      // (red, 500) no debe encerrar al usuario.
      tienePerfil = !(e instanceof PerfilNoEncontrado);
    }
    try {
      const test = await obtenerTestCompatibilidad();
      tieneEncuesta = test.answers != null;
    } catch {
      tieneEncuesta = true;
    }
    setEstado({ cargando: false, tienePerfil, tieneEncuesta });
  }, []);

  useEffect(() => {
    comprobar();
  }, [comprobar]);

  return {
    ...estado,
    completo: estado.tienePerfil && estado.tieneEncuesta,
    refrescar: comprobar,
  };
}
