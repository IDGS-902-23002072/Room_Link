import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { iniciarSesion, registrar } from '@/auth/api-auth';
import { Aviso, BotonPrimario, Campo, Enlace, PantallaAuth, paleta } from '@/auth/ui';

export default function Registro() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function crear() {
    setError('');
    if (!acepta) {
      setError('Debés aceptar los términos de servicio.');
      return;
    }
    setCargando(true);
    try {
      await registrar(email.trim(), password);
      // Auto-login tras el registro para un flujo continuo.
      await iniciarSesion(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <PantallaAuth
      kicker="Bienvenido a RoomLink"
      titulo="Crea tu cuenta"
      subtitulo="Da el primer paso hacia tu próximo hogar."
    >
      <Campo
        etiqueta="Correo electrónico"
        valor={email}
        onChangeText={setEmail}
        placeholder="cesar@correo.com"
        keyboardType="email-address"
      />
      <Campo
        etiqueta="Contraseña"
        valor={password}
        onChangeText={setPassword}
        placeholder="Mínimo 8 caracteres"
        secure
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acepta }}
        onPress={() => setAcepta((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: acepta ? paleta.primario : paleta.borde,
            backgroundColor: acepta ? paleta.primario : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {acepta ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
        </View>
        <Text style={{ color: paleta.tinta, fontSize: 15, fontWeight: '600', flex: 1 }}>
          Acepto los términos de servicio y el aviso de privacidad.
        </Text>
      </Pressable>
      <Aviso texto={error} tono="error" />
      <BotonPrimario etiqueta="Crear mi cuenta" onPress={crear} cargando={cargando} />
      <Enlace
        etiqueta="¿Ya tienes cuenta? Inicia sesión"
        onPress={() => router.replace('/(auth)/login')}
      />
    </PantallaAuth>
  );
}
