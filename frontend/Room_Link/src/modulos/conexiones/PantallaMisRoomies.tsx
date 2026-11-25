
import React, { useEffect, useState } from 'react';

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

import { useRouter } from 'expo-router';

import { Colors } from '@/constants/theme';
import { obtenerUserId } from '@/auth/sesion';

import {
  listarConexiones,
  type ConexionDto,
} from './api';

import { abrirSalaChat } from '../chats/api';

import {
  obtenerPerfilAfinidad,
  type PerfilAfinidad,
} from '../compatibilidad/api';

interface Roomie {
  conexion: ConexionDto;
  perfil: PerfilAfinidad | null;
}

export function PantallaMisRoomies() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const router = useRouter();

  const [roomies, setRoomies] = useState<Roomie[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [abriendoChatId, setAbriendoChatId] = useState<string | null>(null);

  // Consultar conexiones aceptadas y obtener sus perfiles.
  async function consultarRoomies(): Promise<Roomie[]> {
    const userId = obtenerUserId();

    if (!userId) {
      throw new Error('No hay una sesión activa.');
    }

    const conexiones = await listarConexiones('all');

    const aceptadas = conexiones.filter(
      (conexion) => conexion.status === 'accepted',
    );

    const resultado = await Promise.all(
      aceptadas.map(async (conexion): Promise<Roomie> => {
        // Identificar al otro usuario de la conexión.
        const otroUsuarioId =
          conexion.requesterId === userId
            ? conexion.addresseeId
            : conexion.requesterId;

        try {
          const perfil = await obtenerPerfilAfinidad(otroUsuarioId);

          return {
            conexion,
            perfil,
          };
        } catch {
          // Si no se puede consultar el perfil,
          // mostramos la conexión sin información personal.
          return {
            conexion,
            perfil: null,
          };
        }
      }),
    );

    return resultado;
  }

  // Cargar los roomies al abrir la pantalla.
  useEffect(() => {
    let activo = true;

    consultarRoomies()
      .then((resultado) => {
        if (activo) {
          setRoomies(resultado);
        }
      })
      .catch((error) => {
        if (activo) {
          Alert.alert(
            'Error',
            error instanceof Error
              ? error.message
              : 'No se pudo consultar tu historial de roomies.',
          );
        }
      })
      .finally(() => {
        if (activo) {
          setCargando(false);
        }
      });

    return () => {
      activo = false;
    };
  }, []);

  // Actualizar la lista manualmente.
  async function actualizar() {
    setActualizando(true);

    try {
      const resultado = await consultarRoomies();
      setRoomies(resultado);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el historial.',
      );
    } finally {
      setActualizando(false);
    }
  }

  // Abrir o recuperar la sala de chat de una conexión aceptada.
  async function irAlChat(conexion: ConexionDto) {
    if (conexion.status !== 'accepted') {
      Alert.alert(
        'Conexión no disponible',
        'Solo puedes abrir chats de conexiones aceptadas.',
      );
      return;
    }

    try {
      setAbriendoChatId(conexion.id);

      const sala = await abrirSalaChat({
        connectionId: conexion.id,
      });

      router.push({
        pathname: '/chats',
        params: {
          roomId: sala.id,
        },
      });
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'No se pudo abrir la conversación.',
      );
    } finally {
      setAbriendoChatId(null);
    }
  }

  function obtenerFecha(fecha: string) {
    const fechaConvertida = new Date(fecha);

    if (Number.isNaN(fechaConvertida.getTime())) {
      return 'Fecha no disponible';
    }

    return fechaConvertida.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  function renderizarRoomie({ item }: { item: Roomie }) {
    const perfil = item.perfil;
    const abriendoChat = abriendoChatId === item.conexion.id;

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
        <View style={estilos.encabezadoTarjeta}>
          {perfil?.photoUrl ? (
            <Image
              source={{ uri: perfil.photoUrl }}
              style={estilos.foto}
            />
          ) : (
            <View style={estilos.avatar}>
              <Text style={estilos.avatarTexto}>
                {perfil?.fullName?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          )}

          <View style={estilos.informacion}>
            <Text style={[estilos.nombre, { color: colors.text }]}>
              {perfil?.fullName ?? 'Perfil no disponible'}
            </Text>

            {perfil?.age != null && (
              <Text
                style={[
                  estilos.dato,
                  { color: colors.textSecondary },
                ]}
              >
                {perfil.age} años
              </Text>
            )}

            {(perfil?.city || perfil?.zone) && (
              <Text
                style={[
                  estilos.dato,
                  { color: colors.textSecondary },
                ]}
              >
                {[perfil.city, perfil.zone].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>

          <View style={estilos.estado}>
            <Text style={estilos.textoEstado}>Aceptada</Text>
          </View>
        </View>

        <View
          style={[
            estilos.detalle,
            {
              backgroundColor:
                scheme === 'dark' ? '#302A35' : '#F6F1F8',
            },
          ]}
        >
          <Text style={estilos.etiqueta}>
            Conexión aceptada el
          </Text>

          <Text style={[estilos.textoDetalle, { color: colors.text }]}>
            {item.conexion.respondedAt
              ? obtenerFecha(item.conexion.respondedAt)
              : 'Fecha de aceptación no disponible'}
          </Text>
        </View>

        {perfil?.bio && (
          <View style={estilos.biografia}>
            <Text style={estilos.etiqueta}>Acerca de</Text>

            <Text style={[estilos.textoDetalle, { color: colors.text }]}>
              {perfil.bio}
            </Text>
          </View>
        )}

        {item.conexion.introMessage && (
          <View style={estilos.biografia}>
            <Text style={estilos.etiqueta}>
              Mensaje de presentación
            </Text>

            <Text style={[estilos.textoDetalle, { color: colors.text }]}>
              {item.conexion.introMessage}
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            estilos.botonChat,
            pressed && estilos.botonChatPresionado,
            abriendoChat && estilos.botonDeshabilitado,
          ]}
          onPress={() => void irAlChat(item.conexion)}
          disabled={abriendoChat || abriendoChatId !== null}
        >
          {abriendoChat ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={estilos.textoBotonChat}>
              Ir al chat
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        estilos.contenedor,
        { backgroundColor: colors.background },
      ]}
    >
      <View style={estilos.encabezado}>
        <Text style={[estilos.titulo, { color: colors.text }]}>
          Mis roomies
        </Text>

        <Text
          style={[
            estilos.subtitulo,
            { color: colors.textSecondary },
          ]}
        >
          Aquí encontrarás las personas con las que has conectado.
        </Text>
      </View>

      {cargando ? (
        <ActivityIndicator
          size="large"
          color="#81638B"
          style={estilos.cargando}
        />
      ) : (
        <FlatList
          data={roomies}
          keyExtractor={(item) => item.conexion.id}
          renderItem={renderizarRoomie}
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

              <Text style={[estilos.textoVacio, { color: colors.text }]}>
                Todavía no tienes roomies
              </Text>

              <Text
                style={[
                  estilos.detalleVacio,
                  { color: colors.textSecondary },
                ]}
              >
                Cuando una solicitud sea aceptada, la persona aparecerá aquí.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  encabezado: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 15,
  },
  titulo: {
    fontSize: 23,
    fontWeight: 'bold',
  },
  subtitulo: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
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
  foto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8E0EC',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#81638B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  informacion: {
    flex: 1,
    marginLeft: 12,
  },
  nombre: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  dato: {
    fontSize: 12,
    marginTop: 4,
  },
  estado: {
    backgroundColor: '#DDF5E5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
  },
  textoEstado: {
    color: '#247A43',
    fontSize: 11,
    fontWeight: 'bold',
  },
  detalle: {
    marginTop: 15,
    padding: 12,
    borderRadius: 10,
  },
  etiqueta: {
    color: '#81638B',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  textoDetalle: {
    fontSize: 13,
    lineHeight: 19,
  },
  biografia: {
    marginTop: 13,
  },
  botonChat: {
    backgroundColor: '#81638B',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 44,
  },
  botonChatPresionado: {
    opacity: 0.8,
  },
  botonDeshabilitado: {
    opacity: 0.6,
  },
  textoBotonChat: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cargando: {
    marginTop: 50,
  },
  vacio: {
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 80,
  },
  iconoVacio: {
    fontSize: 48,
    color: '#81638B',
    marginBottom: 12,
  },
  textoVacio: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detalleVacio: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
});
