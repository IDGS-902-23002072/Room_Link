
import { Stack, useRouter, useSegments } from 'expo-router';
import { useState } from 'react';

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { useSesion } from '@/auth/SesionContext';
import { Colors } from '@/constants/theme';

type RutaMenu = '/explorar' | '/anuncios' | '/chats' | '/perfil' | '/conexiones' | '/mis-roomies';

interface OpcionMenu {
  titulo: string;
  ruta: RutaMenu;
  roles?: string[];
  icono: string;
}

export default function NavegacionPestanas() {
  const router = useRouter();
  const segmentos = useSegments();
  const { sesion } = useSesion();

  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const oscuro = scheme === 'dark';

  const [menuVisible, setMenuVisible] = useState(false);

  const roles = sesion?.usuario.roles ?? [];

  const opciones: OpcionMenu[] = [
    { titulo: 'Descubrir', ruta: '/explorar', roles: ['seeker'], icono: '⌕' },
    { titulo: 'Anuncios', ruta: '/anuncios', roles: ['seeker', 'host'], icono: '⌂' },
    { titulo: 'Conexiones', ruta: '/conexiones', roles: ['seeker'], icono: '♧' },
    { titulo: 'Chats', ruta: '/chats', roles: ['seeker', 'host'], icono: '☏' },
    { titulo: 'Perfil', ruta: '/perfil', icono: '●' },
    { titulo: 'Mis roomies', ruta: '/mis-roomies', roles: ['seeker'], icono: '♧' },
  ];

  const opcionesDisponibles = opciones.filter((opcion) => {
    if (!opcion.roles) return true;
    return opcion.roles.some((rol) => roles.includes(rol));
  });

  const pantallaActual = String(segmentos[segmentos.length - 1] ?? '');

  function navegar(ruta: RutaMenu) {
    setMenuVisible(false);
    router.navigate(ruta);
  }

  return (
    <View style={[estilos.contenedor, { backgroundColor: colors.background }]}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable
              onPress={() => setMenuVisible(true)}
              style={estilos.botonMenu}
              accessibilityRole="button"
              accessibilityLabel="Abrir menú de navegación"
              hitSlop={10}
            >
              <Text style={[estilos.iconoMenu, { color: colors.text }]}>☰</Text>
            </Pressable>
          ),
        }}
      >
        <Stack.Screen name="explorar" options={{ title: 'Descubrir' }} />
        <Stack.Screen name="anuncios" options={{ title: 'Anuncios' }} />
        <Stack.Screen name="chats" options={{ title: 'Chats' }} />
        <Stack.Screen name="perfil" options={{ title: 'Mi perfil' }} />
        <Stack.Screen
          name="conexiones"
          options={{ title: 'Solicitudes de conexión' }}
        />
        <Stack.Screen
          name="mis-roomies"
          options={{ title: 'Mis roomies' }}
        />
      </Stack>


      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent
      >
        <View style={estilos.modalContenedor}>
          <Pressable
            style={estilos.fondoOscuro}
            onPress={() => setMenuVisible(false)}
          />

          <View
            style={[
              estilos.menuLateral,
              {
                backgroundColor: colors.background,
                borderRightColor: colors.backgroundElement,
              },
            ]}
          >
            <View
              style={[
                estilos.encabezadoMenu,
                { backgroundColor: oscuro ? '#382C40' : '#81638B' },
              ]}
            >
              <View style={estilos.avatar}>
                <Text style={estilos.avatarTexto}>R</Text>
              </View>

              <Text style={estilos.nombreAplicacion}>Room_Link</Text>
              <Text style={estilos.subtitulo}>Tu espacio, tu comunidad</Text>

              <Pressable
                onPress={() => setMenuVisible(false)}
                style={estilos.botonCerrar}
                accessibilityLabel="Cerrar menú"
              >
                <Text style={estilos.textoCerrar}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={estilos.listaMenu}>
              <Text style={[estilos.tituloSeccion, { color: colors.textSecondary }]}>
                MÓDULOS
              </Text>

              {opcionesDisponibles.map((opcion) => {
                const activa = pantallaActual === opcion.ruta.substring(1);

                return (
                  <Pressable
                    key={opcion.ruta}
                    onPress={() => navegar(opcion.ruta)}
                    style={[
                      estilos.opcionMenu,
                      activa && { backgroundColor: colors.backgroundElement },
                    ]}
                  >
                    <Text style={estilos.iconoOpcion}>{opcion.icono}</Text>

                    <Text
                      style={[
                        estilos.textoOpcion,
                        {
                          color: activa ? '#81638B' : colors.text,
                          fontWeight: activa ? 'bold' : '500',
                        },
                      ]}
                    >
                      {opcion.titulo}
                    </Text>

                    {activa && <View style={estilos.indicadorActivo} />}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View
              style={[
                estilos.pieMenu,
                { borderTopColor: colors.backgroundElement },
              ]}
            >
              <Text style={[estilos.version, { color: colors.text }]}>
                Room_Link
              </Text>
              <Text style={estilos.versionSecundaria}>
                Tu espacio, tu comunidad.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  botonMenu: {
    marginLeft: 12,
    marginRight: 18,
    padding: 5,
  },
  iconoMenu: {
    fontSize: 27,
    fontWeight: '500',
  },
  modalContenedor: {
    flex: 1,
    flexDirection: 'row',
  },
  fondoOscuro: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  menuLateral: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    borderRightWidth: StyleSheet.hairlineWidth,
    elevation: 12,
  },
  encabezadoMenu: {
    height: 190,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: 25,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarTexto: {
    color: '#81638B',
    fontSize: 25,
    fontWeight: 'bold',
  },
  nombreAplicacion: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: 'bold',
  },
  subtitulo: {
    color: '#F0E8F3',
    fontSize: 12,
    marginTop: 4,
  },
  botonCerrar: {
    position: 'absolute',
    top: 18,
    right: 18,
    padding: 8,
  },
  textoCerrar: {
    color: '#FFFFFF',
    fontSize: 22,
  },
  listaMenu: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 20,
  },
  tituloSeccion: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  opcionMenu: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 5,
  },
  iconoOpcion: {
    width: 35,
    fontSize: 23,
    color: '#81638B',
  },
  textoOpcion: {
    fontSize: 15,
    flex: 1,
  },
  indicadorActivo: {
    width: 5,
    height: 25,
    borderRadius: 5,
    backgroundColor: '#81638B',
  },
  pieMenu: {
    padding: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  version: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  versionSecundaria: {
    color: '#888888',
    fontSize: 11,
    marginTop: 4,
  },
});
