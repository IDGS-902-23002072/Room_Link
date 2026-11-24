import { useEffect, useState } from 'react';

import { Accion, Aviso, Tarjeta, Texto } from '@/modulos/comunes/InterfazModulo';
import { obtenerPerfil, solicitarVerificacionIdentidad } from '../api';

const estados: Record<string, string> = {
  unverified: 'Sin verificar', pending: 'En revisión', verified: 'Verificada', rejected: 'Rechazada',
};

export function VerificacionIdentidad() {
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ocupada, setOcupada] = useState(false);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    void obtenerPerfil().then(
      (perfil) => { if (activo) setEstado(perfil.identityStatus); },
      (causa: Error) => { if (activo) setError(causa.message); },
    );
    return () => { activo = false; };
  }, [intento]);

  async function solicitar() {
    setOcupada(true);
    setError('');
    try { setEstado((await solicitarVerificacionIdentidad()).identityStatus); }
    catch (causa) { setError(causa instanceof Error ? causa.message : 'No se pudo iniciar la verificación.'); }
    finally { setOcupada(false); }
  }

  return (
    <Tarjeta titulo="Verificación de identidad">
      <Texto>{estado ? estados[estado] ?? estado : error ? 'Estado no disponible' : 'Consultando estado…'}</Texto>
      <Texto secundario>Puedes iniciar la solicitud y consultar su estado aquí. Usa el canal de verificación para entregar documentos o selfies.</Texto>
      <Aviso error>{error}</Aviso>
      {estado && estado !== 'pending' && estado !== 'verified' && (
        <Accion alPulsar={() => void solicitar()} deshabilitada={ocupada} primaria texto="Iniciar verificación" />
      )}
      {!estado && error && <Accion alPulsar={() => { setError(''); setIntento((valor) => valor + 1); }} texto="Reintentar" />}
    </Tarjeta>
  );
}
