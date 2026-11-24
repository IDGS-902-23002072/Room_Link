import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { SesionProvider, useSesion } from '@/auth/SesionContext';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import {
  configurarCanalAndroid,
  sincronizarNotificacionesSistema,
  solicitarPermisoNotificacionesSistema,
} from '@/modulos/notificaciones/permisosSistema';

SplashScreen.preventAutoHideAsync();

function Navegacion() {
  const colorScheme = useColorScheme();
  const { sesion, cargando } = useSesion();
  const segmentos = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    const enAuth = segmentos[0] === '(auth)';
    if (!sesion && !enAuth) {
      router.replace('/(auth)/login');
    } else if (sesion && enAuth) {
      router.replace('/anuncios');
    }
  }, [sesion, cargando, segmentos, router]);

  useEffect(() => {
    if (!sesion) return;
    let activo = true;
    void configurarCanalAndroid();
    void solicitarPermisoNotificacionesSistema().then(() => {
      if (activo) void sincronizarNotificacionesSistema();
    });
    const intervalo = setInterval(() => {
      if (activo) void sincronizarNotificacionesSistema();
    }, 20000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [sesion]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(pestanas)" />
        <Stack.Screen name="encuesta" />
        <Stack.Screen name="moderacion" />
        <Stack.Screen name="notificaciones" />
        <Stack.Screen name="acuerdos" />
        <Stack.Screen name="conexiones" />
        <Stack.Screen name="sanciones" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SesionProvider>
      <Navegacion />
    </SesionProvider>
  );
}
