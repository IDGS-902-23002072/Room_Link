import { useRouter } from 'expo-router';
import { useState } from 'react';

import { iniciarSesion } from '@/auth/api-auth';
import { entrarConGoogle, googleDisponible } from '@/auth/google-sign-in';
import { Aviso, BotonPrimario, Campo, Enlace, PantallaAuth } from '@/auth/ui';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setError('');
    setCargando(true);
    try {
      await iniciarSesion(email.trim(), password);
      // El gating del root layout redirige a las pestañas al detectar sesión.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  async function google() {
    if (cargando) return;
    setError('');
    setCargando(true);
    try {
      await entrarConGoogle(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo continuar con Google.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <PantallaAuth
      kicker="Bienvenido a RoomLink"
      titulo="Inicia sesión"
      subtitulo="Qué gusto tenerte de vuelta."
    >
      <Campo
        etiqueta="Correo electrónico"
        testID="login-email"
        valor={email}
        onChangeText={setEmail}
        placeholder="cesar@correo.com"
        keyboardType="email-address"
      />
      <Campo
        etiqueta="Contraseña"
        testID="login-password"
        valor={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secure
      />
      <Aviso texto={error} tono="error" />
      <BotonPrimario etiqueta="Iniciar sesión" onPress={entrar} cargando={cargando} />
      {googleDisponible && <BotonPrimario etiqueta="Continuar con Google" onPress={google} cargando={cargando} variante="contorno" />}
      <Enlace
        etiqueta="¿Olvidaste tu contraseña?"
        onPress={() => router.push('/(auth)/recuperar')}
      />
      <Enlace
        etiqueta="¿Eres nuevo? Crea tu cuenta"
        onPress={() => router.push('/(auth)/registro')}
      />
    </PantallaAuth>
  );
}
