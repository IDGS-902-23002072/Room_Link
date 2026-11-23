import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { restablecerPassword, solicitarRecuperacion } from '@/auth/api-auth';
import { Aviso, BotonPrimario, Campo, Enlace, PantallaAuth, paleta } from '@/auth/ui';

export default function Recuperar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviarEnlace() {
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      setMensaje(await solicitarRecuperacion(email.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el enlace.');
    } finally {
      setCargando(false);
    }
  }

  async function guardar() {
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      setMensaje(await restablecerPassword(token.trim(), password));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <PantallaAuth
      kicker="Bienvenido a RoomLink"
      titulo="Recupera tu acceso"
      subtitulo="Te ayudamos a volver a RoomLink."
    >
      <Campo
        etiqueta="Correo electrónico"
        valor={email}
        onChangeText={setEmail}
        placeholder="cesar@correo.com"
        keyboardType="email-address"
      />
      <BotonPrimario etiqueta="Enviar enlace" onPress={enviarEnlace} cargando={cargando} />

      <Text
        style={{
          color: paleta.tenue,
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: 8,
        }}
      >
        Después de abrir el enlace
      </Text>
      <Campo
        etiqueta="Código del enlace"
        valor={token}
        onChangeText={setToken}
        placeholder="Pégalo desde el correo"
      />
      <Campo
        etiqueta="Nueva contraseña"
        valor={password}
        onChangeText={setPassword}
        placeholder="••••••••••"
        secure
      />
      <Aviso texto={error} tono="error" />
      <Aviso texto={mensaje} tono="ok" />
      <BotonPrimario
        etiqueta="Guardar nueva contraseña"
        onPress={guardar}
        cargando={cargando}
        variante="contorno"
      />
      <Enlace etiqueta="Volver a iniciar sesión" onPress={() => router.replace('/(auth)/login')} />
    </PantallaAuth>
  );
}
