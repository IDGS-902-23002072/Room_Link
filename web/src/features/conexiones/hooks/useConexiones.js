
import { useCallback, useEffect, useState } from "react";

import {
  obtenerConexiones,
  obtenerPerfil,
  obtenerFotosPerfil,
  responderConexion,
  cancelarConexion,
} from "../services/conexionesApi.js";

// El endpoint de fotografías devuelve { items, photos }.
function extraerFotos(respuesta) {
  if (Array.isArray(respuesta)) return respuesta;

  return respuesta?.items ?? respuesta?.photos ?? [];
}

// Identificar al otro participante de la conexión.
function obtenerOtroUsuario(conexion, userId) {
  return conexion.requesterId === userId
    ? conexion.addresseeId
    : conexion.requesterId;
}

export function useConexiones(token, userId) {
  const [conexiones, setConexiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState(false);

  const cargarConexiones = useCallback(async () => {
    if (!token || !userId) {
      setConexiones([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    try {
      // Consultar solicitudes recibidas y enviadas.
      const [recibidas, enviadas] = await Promise.all([
        obtenerConexiones(token, "incoming"),
        obtenerConexiones(token, "outgoing"),
      ]);

      // Unificar ambas listas evitando conexiones repetidas.
      const conexionesUnicas = [
        ...new Map(
          [...recibidas, ...enviadas].map((conexion) => [
            conexion.id,
            conexion,
          ])
        ).values(),
      ];

      // Obtener el perfil y las fotografías de cada participante.
      const conexionesCompletas = await Promise.all(
        conexionesUnicas.map(async (conexion) => {
          const otroUsuarioId = obtenerOtroUsuario(conexion, userId);

          const direction =
            conexion.requesterId === userId
              ? "outgoing"
              : "incoming";

          try {
            const [perfil, fotosResponse] = await Promise.all([
              obtenerPerfil(token, otroUsuarioId),
              obtenerFotosPerfil(token, otroUsuarioId),
            ]);

            const fotos = extraerFotos(fotosResponse);

            const fotoPrincipal =
              fotos.find((foto) => foto.isMain) ??
              [...fotos].sort(
                (a, b) => a.position - b.position
              )[0] ??
              null;

            return {
              ...conexion,
              direction,
              perfil,
              fotos,
              fotoPrincipal,
            };
          } catch {
            // Si falla el perfil, conservamos la conexión.
            return {
              ...conexion,
              direction,
              perfil: null,
              fotos: [],
              fotoPrincipal: null,
            };
          }
        })
      );

      setConexiones(conexionesCompletas);
    } catch (err) {
      setError(
        err.message || "No se pudieron cargar las conexiones."
      );
    } finally {
      setCargando(false);
    }
  }, [token, userId]);

  useEffect(() => {
    cargarConexiones();
  }, [cargarConexiones]);

  // Aceptar o rechazar una solicitud recibida.
  const responder = async (connectionId, decision) => {
    try {
      setActualizando(true);
      setError("");

      await responderConexion(token, connectionId, decision);

      await cargarConexiones();

      return true;
    } catch (err) {
      setError(
        err.message || "No se pudo responder la solicitud."
      );

      return false;
    } finally {
      setActualizando(false);
    }
  };

  // Cancelar una solicitud enviada.
  const cancelar = async (connectionId) => {
    try {
      setActualizando(true);
      setError("");

      await cancelarConexion(token, connectionId);

      await cargarConexiones();

      return true;
    } catch (err) {
      setError(
        err.message || "No se pudo cancelar la solicitud."
      );

      return false;
    } finally {
      setActualizando(false);
    }
  };

  // Separar las conexiones para mostrarlas en diferentes apartados.
  const recibidas = conexiones.filter(
    (conexion) => conexion.direction === "incoming"
  );

  const enviadas = conexiones.filter(
    (conexion) => conexion.direction === "outgoing"
  );

  const aceptadas = conexiones.filter(
    (conexion) => conexion.status === "accepted"
  );

  return {
    conexiones,
    recibidas,
    enviadas,
    aceptadas,
    cargando,
    error,
    actualizando,
    cargarConexiones,
    responder,
    cancelar,
  };
}
