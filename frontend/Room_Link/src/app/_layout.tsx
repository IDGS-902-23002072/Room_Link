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

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(pestanas)" />
        <Stack.Screen name="encuesta" />
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
