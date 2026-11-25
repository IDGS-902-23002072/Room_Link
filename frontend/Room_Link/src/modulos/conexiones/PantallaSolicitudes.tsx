
import React, { useCallback, useEffect, useState } from 'react';

import { Link } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import {
  listarConexiones,
  responderConexion,
  cancelarConexion,
  type ConexionDto,
  type DireccionConexion,
} from './api';

import { Colors } from '@/constants/theme';

import {
  obtenerPerfilPublicoPorId,
  obtenerFotoPrincipal,
  type PerfilPublico,
} from '../perfil/api';

// ==========================================
// TIPOS
// ==========================================

interface PerfilConexion {
  perfil: PerfilPublico;
  fotoUrl: string | null;
}

// ==========================================
// PANTALLA DE SOLICITUDES
// ==========================================

export function PantallaSolicitudes() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const oscuro = scheme === 'dark';

  // ==========================================
  // ESTADOS
  // ==========================================

  const [direccion, setDireccion] =
    useState<DireccionConexion>('incoming');

  const [conexiones, setConexiones] = useState<ConexionDto[]>([]);

  const [perfiles, setPerfiles] = useState<
    Record<string, PerfilConexion | null>
  >({});

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  // ==========================================
  // CONSULTAR LOS PERFILES DE LAS CONEXIONES
  // ==========================================

  const cargarPerfiles = useCallback(
    async (resultado: ConexionDto[]) => {
      const perfilesCargados: Record<string, PerfilConexion | null> = {};

      await Promise.all(
        resultado.map(async (conexion) => {
          // En recibidas mostramos a quien envió la solicitud.
          // En enviadas mostramos a quien recibió la solicitud.

          const otroUsuarioId =
            direccion === 'incoming'
              ? conexion.requesterId
              : conexion.addresseeId;

          try {
            // Consultar perfil y fotografía al mismo tiempo.

            const [perfil, foto] = await Promise.all([
              obtenerPerfilPublicoPorId(otroUsuarioId),
              obtenerFotoPrincipal(otroUsuarioId),
            ]);

            perfilesCargados[conexion.id] = {
              perfil,
              fotoUrl: foto?.url ?? null,
            };
          } catch (error) {
            console.error(
              `No se pudo cargar el perfil de ${otroUsuarioId}:`,
              error,
            );

            perfilesCargados[conexion.id] = null;
          }
        }),
      );

      return perfilesCargados;
    },
    [direccion],
  );

  // ==========================================
  // CARGAR SOLICITUDES
  // ==========================================

  const cargarConexiones = useCallback(async () => {
    try {
      const resultado = await listarConexiones(direccion);

      const perfilesCargados = await cargarPerfiles(resultado);

      setConexiones(resultado);
      setPerfiles(perfilesCargados);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar las conexiones.',
      );
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [direccion, cargarPerfiles]);

  // ==========================================
  // EFECTO PARA CARGAR LAS SOLICITUDES
  // ==========================================

  useEffect(() => {
    let activo = true;

    async function consultar() {
      try {
        const resultado = await listarConexiones(direccion);

        const perfilesCargados = await cargarPerfiles(resultado);

        if (activo) {
          setConexiones(resultado);
          setPerfiles(perfilesCargados);
        }
      } catch (error) {
        if (activo) {
          Alert.alert(
            'Error',
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar las conexiones.',
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
          setActualizando(false);
        }
      }
    }

    consultar();

    return () => {
      activo = false;
    };
  }, [direccion, cargarPerfiles]);

  // ==========================================
  // ACTUALIZAR LISTA
  // ==========================================

  function actualizar() {
    setActualizando(true);
    cargarConexiones();
  }

  // ==========================================
  // ACEPTAR O RECHAZAR SOLICITUD
  // ==========================================

  async function responder(
    conexion: ConexionDto,
    decision: 'accept' | 'reject',
  ) {
    const mensaje =
      decision === 'accept'
        ? '¿Deseas aceptar esta solicitud de conexión?'
        : '¿Deseas rechazar esta solicitud de conexión?';

    Alert.alert(
      decision === 'accept'
        ? 'Aceptar solicitud'
        : 'Rechazar solicitud',
      mensaje,
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Sí, continuar',
          onPress: async () => {
            try {
              setProcesando(conexion.id);

              await responderConexion(conexion.id, decision);

              Alert.alert(
                'Solicitud actualizada',
                decision === 'accept'
                  ? 'Ahora están conectados.'
                  : 'La solicitud fue rechazada.',
              );

              await cargarConexiones();
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'No se pudo responder la solicitud.',
              );
            } finally {
              setProcesando(null);
            }
          },
        },
      ],
    );
  }

  // ==========================================
  // CANCELAR SOLICITUD ENVIADA
  // ==========================================

  async function cancelar(conexion: ConexionDto) {
    Alert.alert(
      'Cancelar solicitud',
      '¿Deseas cancelar esta solicitud enviada?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Cancelar solicitud',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcesando(conexion.id);

              await cancelarConexion(conexion.id);

              Alert.alert(
                'Solicitud cancelada',
                'La solicitud fue cancelada correctamente.',
              );

              await cargarConexiones();
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'No se pudo cancelar la solicitud.',
              );
            } finally {
              setProcesando(null);
            }
          },
        },
      ],
    );
  }

  // ==========================================
  // FORMATEAR FECHA
  // ==========================================

  function obtenerFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  // ==========================================
  // MOSTRAR ESTADO
  // ==========================================

  function obtenerEstado(estado: ConexionDto['status']) {
    const estados = {
      pending: 'Pendiente',
      accepted: 'Aceptada',
      rejected: 'Rechazada',
      cancelled: 'Cancelada',
    };

    return estados[estado];
  }

  // ==========================================
  // RENDERIZAR CADA SOLICITUD
  // ==========================================

  function renderizarConexion({ item }: { item: ConexionDto }) {
    const pendiente = item.status === 'pending';
    const ocupado = procesando === item.id;

    const datos = perfiles[item.id];
    const perfil = datos?.perfil;

    const detallesPerfil = perfil
      ? [
          perfil.age ? `${perfil.age} años` : null,
          perfil.occupation,
        ]
          .filter((dato): dato is string => Boolean(dato))
          .join(' · ')
      : 'No se pudo cargar el perfil.';

    return (
      <View
        style={[
          estilos.tarjeta,
          {
            backgroundColor: colors.background,
            borderColor: colors.backgroundElement,
          },
        ]}
      >
        {/* ENCABEZADO DE LA TARJETA */}

        <View style={estilos.encabezadoTarjeta}>
          <View style={estilos.avatar}>
            {datos?.fotoUrl ? (
              <Image
                source={{ uri: datos.fotoUrl }}
                style={estilos.avatarImagen}
                resizeMode="cover"
              />
            ) : (
              <Text style={estilos.avatarTexto}>
                {perfil?.fullName?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            )}
          </View>

          <View style={estilos.informacion}>
            <Text style={[estilos.nombre, { color: colors.text }]}>
              {perfil?.fullName ?? 'Perfil no disponible'}
            </Text>

            <Text
              style={[
                estilos.fecha,
                { color: colors.textSecondary },
              ]}
            >
              {direccion === 'incoming'
                ? 'Solicitud recibida'
                : 'Solicitud enviada'}
              {' · '}
              {obtenerFecha(item.createdAt)}
            </Text>
          </View>

          {/* ESTADO */}

          <View
            style={[
              estilos.estado,
              {
                backgroundColor:
                  item.status === 'accepted'
                    ? '#DDF5E5'
                    : item.status === 'rejected'
                      ? '#FCE4E4'
                      : item.status === 'cancelled'
                        ? '#E8E8E8'
                        : '#F1E8F5',
              },
            ]}
          >
            <Text
              style={[
                estilos.textoEstado,
                {
                  color:
                    item.status === 'accepted'
                      ? '#247A43'
                      : item.status === 'rejected'
                        ? '#B52D2D'
                        : item.status === 'cancelled'
                          ? '#666666'
                          : '#81638B',
                },
              ]}
            >
              {obtenerEstado(item.status)}
            </Text>
          </View>
        </View>

        {/* INFORMACIÓN DEL PERFIL */}

        <Text
          style={[
            estilos.detalle,
            { color: colors.textSecondary },
          ]}
        >
          {detallesPerfil}
        </Text>

        {/* BIOGRAFÍA */}

        {perfil?.bio ? (
          <Text
            style={[
              estilos.detalle,
              { color: colors.text },
            ]}
          >
            {perfil.bio}
          </Text>
        ) : null}

        {/* MENSAJE DE PRESENTACIÓN */}

        {item.introMessage ? (
          <View
            style={[
              estilos.mensaje,
              {
                backgroundColor: oscuro ? '#302A35' : '#F6F1F8',
              },
            ]}
          >
            <Text style={estilos.etiquetaMensaje}>
              Mensaje de presentación
            </Text>

            <Text
              style={[
                estilos.textoMensaje,
                { color: colors.text },
              ]}
            >
              {item.introMessage}
            </Text>
          </View>
        ) : (
          <Text style={estilos.sinMensaje}>
            Sin mensaje de presentación.
          </Text>
        )}

        {/* BOTONES PARA SOLICITUDES RECIBIDAS */}

        {pendiente && direccion === 'incoming' && (
          <View style={estilos.botones}>
            <Pressable
              style={[estilos.boton, estilos.botonAceptar]}
              disabled={ocupado}
              onPress={() => responder(item, 'accept')}
            >
              <Text style={estilos.textoBoton}>
                Aceptar
              </Text>
            </Pressable>

            <Pressable
              style={[estilos.boton, estilos.botonRechazar]}
              disabled={ocupado}
              onPress={() => responder(item, 'reject')}
            >
              <Text style={estilos.textoBotonRechazar}>
                Rechazar
              </Text>
            </Pressable>
          </View>
        )}

        {/* BOTÓN PARA SOLICITUDES ENVIADAS */}

        {pendiente && direccion === 'outgoing' && (
          <Pressable
            style={[estilos.boton, estilos.botonCancelar]}
            disabled={ocupado}
            onPress={() => cancelar(item)}
          >
            <Text style={estilos.textoBotonRechazar}>
              Cancelar solicitud
            </Text>
          </Pressable>
        )}

        {/* INDICADOR DE PROCESAMIENTO */}

        {ocupado && (
          <ActivityIndicator
            color="#81638B"
            style={estilos.indicador}
          />
        )}
      </View>
    );
  }

  // ==========================================
  // INTERFAZ PRINCIPAL
  // ==========================================

  return (
    <View
      style={[
        estilos.contenedor,
        { backgroundColor: colors.background },
      ]}
    >
      {/* ENCABEZADO */}

      <View style={estilos.encabezado}>
        <Text style={[estilos.titulo, { color: colors.text }]}>
          Mis conexiones
        </Text>

        <Text
          style={[
            estilos.subtitulo,
            { color: colors.textSecondary },
          ]}
        >
          Administra tus solicitudes de conexión.
        </Text>
        <Link href="/mis-roomies" style={[estilos.subtitulo, { color: colors.text, textDecorationLine: 'underline' }]}>
          Mis roomies
        </Link>
      </View>

      {/* PESTAÑAS */}

      <View style={estilos.pestanas}>
        <Pressable
          onPress={() => setDireccion('incoming')}
          style={[
            estilos.pestana,
            direccion === 'incoming' && estilos.pestanaActiva,
          ]}
        >
          <Text
            style={[
              estilos.textoPestana,
              direccion === 'incoming' && estilos.textoPestanaActivo,
            ]}
          >
            Recibidas
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setDireccion('outgoing')}
          style={[
            estilos.pestana,
            direccion === 'outgoing' && estilos.pestanaActiva,
          ]}
        >
          <Text
            style={[
              estilos.textoPestana,
              direccion === 'outgoing' && estilos.textoPestanaActivo,
            ]}
          >
            Enviadas
          </Text>
        </Pressable>
      </View>

      {/* LISTA DE SOLICITUDES */}

      {cargando ? (
        <ActivityIndicator
          size="large"
          color="#81638B"
          style={estilos.cargando}
        />
      ) : (
        <FlatList
          data={conexiones}
          keyExtractor={(item) => item.id}
          renderItem={renderizarConexion}
          contentContainerStyle={estilos.lista}
          refreshControl={
            <RefreshControl
              refreshing={actualizando}
              onRefresh={actualizar}
              tintColor="#81638B"
            />
          }
          ListEmptyComponent={
            <View style={estilos.vacio}>
              <Text style={estilos.iconoVacio}>♧</Text>

              <Text
                style={[
                  estilos.textoVacio,
                  { color: colors.text },
                ]}
              >
                No hay solicitudes
              </Text>

              <Text
                style={[
                  estilos.detalleVacio,
                  { color: colors.textSecondary },
                ]}
              >
                {direccion === 'incoming'
                  ? 'Aquí aparecerán las solicitudes que recibas.'
                  : 'Aquí aparecerán las solicitudes que envíes.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ==========================================
// ESTILOS
// ==========================================

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
  },

  encabezado: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },

  titulo: {
    fontSize: 23,
    fontWeight: 'bold',
  },

  subtitulo: {
    fontSize: 13,
    marginTop: 5,
  },

  pestanas: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
  },

  pestana: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
  },

  pestanaActiva: {
    borderBottomWidth: 3,
    borderBottomColor: '#81638B',
  },

  textoPestana: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },

  textoPestanaActivo: {
    color: '#81638B',
    fontWeight: 'bold',
  },

  lista: {
    padding: 16,
    paddingBottom: 30,
    flexGrow: 1,
  },

  tarjeta: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    marginBottom: 14,
  },

  encabezadoTarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#81638B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  avatarImagen: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },

  avatarTexto: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },

  informacion: {
    flex: 1,
    marginLeft: 11,
  },

  nombre: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  fecha: {
    fontSize: 12,
    marginTop: 4,
  },

  estado: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 15,
  },

  textoEstado: {
    fontSize: 11,
    fontWeight: 'bold',
  },

  detalle: {
    fontSize: 11,
    marginTop: 12,
  },

  mensaje: {
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },

  etiquetaMensaje: {
    color: '#81638B',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 5,
  },

  textoMensaje: {
    fontSize: 13,
    lineHeight: 19,
  },

  sinMensaje: {
    color: '#888888',
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },

  botones: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },

  boton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },

  botonAceptar: {
    backgroundColor: '#81638B',
  },

  botonRechazar: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#B65B5B',
  },

  botonCancelar: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#B65B5B',
  },

  textoBoton: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },

  textoBotonRechazar: {
    color: '#B65B5B',
    fontWeight: 'bold',
    fontSize: 13,
  },

  indicador: {
    marginTop: 10,
  },

  cargando: {
    marginTop: 50,
  },

  vacio: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingTop: 75,
  },

  iconoVacio: {
    fontSize: 48,
    color: '#81638B',
    marginBottom: 12,
  },

  textoVacio: {
    fontSize: 17,
    fontWeight: 'bold',
  },

  detalleVacio: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 19,
  },
});
