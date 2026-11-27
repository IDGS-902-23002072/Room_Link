import { color } from '@/constants/roomlink';
import { MarcaRoomLink } from '@/components/MarcaRoomLink';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const colors = Colors.light;
  const oscuro = false;

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
                    ? color.menta
                    : item.status === 'rejected'
                      ? color.rosa
                      : item.status === 'cancelled'
                        ? color.rosa
                        : color.crema,
              },
            ]}
          >
            <Text
              style={[
                estilos.textoEstado,
                {
                  color:
                    item.status === 'accepted'
                      ? color.accion
                      : item.status === 'rejected'
                        ? color.rosaTexto
                        : item.status === 'cancelled'
                          ? color.rosaTexto
                          : color.accion,
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
            color={color.accion}
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
    <SafeAreaView edges={['top', 'left', 'right']}
      style={[
        estilos.contenedor,
        { backgroundColor: colors.background },
      ]}
    >
      {/* ENCABEZADO */}

      <View style={estilos.encabezado}>
        <MarcaRoomLink />
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
          color={color.accion}
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
              tintColor={color.accion}
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
    </SafeAreaView>
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
    gap: 10,
  },

  titulo: {
    fontSize: 32,
    fontWeight: '600',
  },

  subtitulo: {
    fontSize: 13,
    marginTop: 5,
  },

  pestanas: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: color.borde,
  },

  pestana: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
  },

  pestanaActiva: {
    borderBottomWidth: 3,
    borderBottomColor: color.accion,
  },

  textoPestana: {
    fontSize: 14,
    color: color.secundario,
    fontWeight: '500',
  },

  textoPestanaActivo: {
    color: color.accion,
    fontWeight: '600',
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
    backgroundColor: color.accion,
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
    fontWeight: '600',
  },

  informacion: {
    flex: 1,
    marginLeft: 11,
  },

  nombre: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '600',
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
    color: color.accion,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 5,
  },

  textoMensaje: {
    fontSize: 13,
    lineHeight: 19,
  },

  sinMensaje: {
    color: color.secundario,
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
    minHeight: 48,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },

  botonAceptar: {
    backgroundColor: color.accion,
  },

  botonRechazar: {
    backgroundColor: color.rosa,
    borderWidth: 1,
    borderColor: color.rosa,
  },

  botonCancelar: {
    backgroundColor: color.rosa,
    borderWidth: 1,
    borderColor: color.rosa,
  },

  textoBoton: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },

  textoBotonRechazar: {
    color: color.rosaTexto,
    fontWeight: '600',
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
    color: color.accion,
    marginBottom: 12,
  },

  textoVacio: {
    fontSize: 17,
    fontWeight: '600',
  },

  detalleVacio: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 19,
  },
});
