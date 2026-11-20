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

SplashScreen.preventAutoHideAsync();

function NavegacionPrincipal() {
  const { sesion, cargando } = useSesion();
  const router = useRouter();
  const segments = useSegments();
  const scheme = useColorScheme();

  useEffect(() => {
    if (cargando) return;

    const enAuth = segments[0] === '(auth)';
    const enPestanas = segments[0] === '(pestanas)';

    if (!sesion && !enAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (sesion && !enPestanas) {
      router.replace('/(pestanas)/explorar');
    }
  }, [sesion, cargando, segments, router]);

  useEffect(() => {
    if (!cargando) {
      SplashScreen.hideAsync();
    }
  }, [cargando]);

  if (cargando) return null;

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(pestanas)" />
        <Stack.Screen name="index" />
        <Stack.Screen name="acuerdos" />
        <Stack.Screen name="conexiones" />
        <Stack.Screen name="encuesta" />
        <Stack.Screen name="galeria-fotos" />
        <Stack.Screen name="moderacion" />
        <Stack.Screen name="notificaciones" />
        <Stack.Screen name="sanciones" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SesionProvider>
      <NavegacionPrincipal />
    </SesionProvider>
  );
}
