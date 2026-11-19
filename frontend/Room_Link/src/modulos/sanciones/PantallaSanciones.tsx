import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSesion } from '@/auth/SesionContext';

import {
  emitirSancion,
  listarSancionesUsuario,
  revocarSancion,
  type SancionDto,
  type TipoSancion,
} from './api';

const TIPOS_SANCION: { key: TipoSancion; label: string }[] = [
  { key: 'warning', label: 'Advertencia' },
  { key: 'temporary_suspension', label: 'Suspensión temp.' },
  { key: 'permanent_ban', label: 'Baneo permanente' },
  { key: 'listing_removed', label: 'Retiro anuncio' },
  { key: 'dismissed', label: 'Desestimada' },
];

export function PantallaSanciones() {
  const { sesion } = useSesion();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);
  const esAdmin = Boolean(sesion?.usuario.roles?.includes('admin'));

  const [userIdConsulta, setUserIdConsulta] = useState('');
  const [sanciones, setSanciones] = useState<SancionDto[]>([]);
  const [consultado, setConsultado] = useState(false);

  const [userIdObjetivo, setUserIdObjetivo] = useState('');
  const [listingIdObjetivo, setListingIdObjetivo] = useState('');
  const [reportIdObjetivo, setReportIdObjetivo] = useState('');
  const [tipo, setTipo] = useState<TipoSancion>('warning');
  const [motivo, setMotivo] = useState('');
  const [expiraEn, setExpiraEn] = useState('');

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  if (!esAdmin) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
        <View style={[styles.contenido, { width: anchoContenido }]}>
          <Text style={styles.eyebrow}>ROOMLINK / ADMINISTRACIÓN</Text>
          <Text style={styles.titulo}>Acceso restringido</Text>
          <Text style={styles.subtitulo}>
            El panel de sanciones requiere rol de administrador.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.botonPrimario}>
            <Text style={styles.textoBotonPrimario}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const buscar = async (uid = userIdConsulta) => {
    if (!uid.trim()) {
      setError('Indica el UUID del usuario para consultar su historial.');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const res = await listarSancionesUsuario(uid);
      setSanciones(res);
      setConsultado(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron consultar las sanciones.',
      );
    } finally {
      setCargando(false);
    }
  };

  const emitir = async () => {
    if (!motivo.trim()) {
      setError('El motivo de la sanción es obligatorio.');
      return;
    }
    if (!userIdObjetivo.trim() && !listingIdObjetivo.trim()) {
      setError('Indica al menos el ID de usuario o el ID de anuncio.');
      return;
    }
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const creada = await emitirSancion({
        userId: userIdObjetivo,
        listingId: listingIdObjetivo,
        reportId: reportIdObjetivo,
        type: tipo,
        reason: motivo,
        expiresAt: expiraEn || null,
      });
      setMensaje(`Sanción #${creada.id.slice(0, 8)} emitida correctamente.`);
      setMotivo('');
      if (creada.userId) {
        setUserIdConsulta(creada.userId);
        await buscar(creada.userId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo emitir la sanción.',
      );
    } finally {
      setCargando(false);
    }
  };

  const revocar = async (id: string) => {
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      await revocarSancion(id);
      setMensaje('Sanción revocada.');
      if (userIdConsulta.trim()) {
        await buscar(userIdConsulta);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo revocar la sanción.',
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { width: anchoContenido }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.encabezadoNavegacion}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.botonVolver}>
            <Text style={styles.textoVolver}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>ROOMLINK / ADMINISTRACIÓN</Text>
            <Text style={styles.titulo}>Sanciones de cuentas</Text>
            <Text style={styles.subtitulo}>
              Emisión, consulta y revocación de sanciones disciplinarias.
            </Text>
          </View>
        </View>

        {error ? (
          <View accessibilityRole="alert" style={styles.avisoError}>
            <Text style={styles.textoAvisoError}>{error}</Text>
          </View>
        ) : null}
        {mensaje ? (
          <View accessibilityRole="alert" style={styles.avisoOk}>
            <Text style={styles.textoAvisoOk}>{mensaje}</Text>
          </View>
        ) : null}

        <View style={styles.tarjeta}>
          <Text style={styles.tituloItem}>Emitir nueva sanción</Text>
          <View style={styles.chipsWrap}>
            {TIPOS_SANCION.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setTipo(t.key)}
                style={[
                  styles.chipTipo,
                  tipo === t.key && styles.chipTipoActivo,
                ]}>
                <Text
                  style={[
                    styles.textoChipTipo,
                    tipo === t.key && styles.textoChipTipoActivo,
                  ]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={userIdObjetivo}
            onChangeText={setUserIdObjetivo}
            placeholder="UUID del usuario sancionado (userId)"
            placeholderTextColor="#B4ACBD"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={listingIdObjetivo}
            onChangeText={setListingIdObjetivo}
            placeholder="UUID del anuncio (opcional, listingId)"
            placeholderTextColor="#B4ACBD"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={reportIdObjetivo}
            onChangeText={setReportIdObjetivo}
            placeholder="UUID de la denuncia origen (opcional, reportId)"
            placeholderTextColor="#B4ACBD"
            style={styles.input}
            autoCapitalize="none"
          />
          {tipo === 'temporary_suspension' ? (
            <TextInput
              value={expiraEn}
              onChangeText={setExpiraEn}
              placeholder="Expiración ISO (ej. 2027-01-15T00:00:00Z)"
              placeholderTextColor="#B4ACBD"
              style={styles.input}
              autoCapitalize="none"
            />
          ) : null}
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Motivo detallado de la sanción"
            placeholderTextColor="#B4ACBD"
            style={styles.input}
          />

          <Pressable
            accessibilityRole="button"
            disabled={cargando}
            onPress={emitir}
            style={styles.botonPeligro}>
            {cargando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotonPrimario}>Aplicar sanción</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.tarjeta}>
          <Text style={styles.tituloItem}>Consultar historial por usuario</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={userIdConsulta}
              onChangeText={setUserIdConsulta}
              placeholder="UUID del usuario"
              placeholderTextColor="#B4ACBD"
              style={[styles.input, { flex: 1 }]}
              autoCapitalize="none"
            />
            <Pressable
              accessibilityRole="button"
              disabled={cargando}
              onPress={() => buscar(userIdConsulta)}
              style={styles.botonPrimarioCompacto}>
              <Text style={styles.textoBotonPrimario}>Buscar</Text>
            </Pressable>
          </View>

          {consultado && sanciones.length === 0 ? (
            <Text style={styles.metaItem}>
              Este usuario no registra sanciones.
            </Text>
          ) : null}

          {sanciones.map((s) => (
            <View key={s.id} style={styles.itemSancion}>
              <View style={styles.filaEntre}>
                <Text style={styles.tipoSancionTexto}>
                  {s.type.toUpperCase()}
                </Text>
                <Text style={styles.metaItem}>
                  #{s.id.slice(0, 6).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.motivoSancion}>{s.reason}</Text>
              <Text style={styles.metaItem}>
                Creada: {s.createdAt}
                {s.expiresAt ? ` · Expira: ${s.expiresAt}` : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={cargando}
                onPress={() => revocar(s.id)}
                style={styles.botonSecundario}>
                <Text style={styles.textoBotonSecundario}>Revocar sanción</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  areaSegura: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#ECE6F1',
  },
  contenido: {
    flexGrow: 1,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 14,
  },
  encabezadoNavegacion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  botonVolver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7DDEC',
  },
  textoVolver: {
    color: '#81638B',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  eyebrow: {
    color: '#8A8294',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  titulo: {
    color: '#2B2531',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitulo: {
    color: '#8A8294',
    fontSize: 14,
    marginTop: 2,
  },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7DDEC',
    padding: 16,
    gap: 10,
  },
  tituloItem: {
    color: '#2B2531',
    fontSize: 16,
    fontWeight: '800',
  },
  metaItem: {
    color: '#8A8294',
    fontSize: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipTipo: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ECE3F0',
  },
  chipTipoActivo: {
    backgroundColor: '#81638B',
  },
  textoChipTipo: {
    color: '#6F5B76',
    fontSize: 12,
    fontWeight: '700',
  },
  textoChipTipoActivo: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FAF7FC',
    borderWidth: 1.5,
    borderColor: '#E7DDEC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#2B2531',
  },
  botonPrimario: {
    backgroundColor: '#81638B',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPrimarioCompacto: {
    backgroundColor: '#81638B',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPeligro: {
    backgroundColor: '#C0564F',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonPrimario: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  botonSecundario: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D8CADF',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonSecundario: {
    color: '#2B2531',
    fontSize: 12,
    fontWeight: '700',
  },
  itemSancion: {
    borderTopWidth: 1,
    borderTopColor: '#E7DDEC',
    paddingTop: 10,
    gap: 6,
  },
  filaEntre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tipoSancionTexto: {
    color: '#C0564F',
    fontSize: 12,
    fontWeight: '800',
  },
  motivoSancion: {
    color: '#2B2531',
    fontSize: 13,
    fontWeight: '600',
  },
  avisoError: {
    backgroundColor: '#F7E3E1',
    borderRadius: 14,
    padding: 12,
  },
  textoAvisoError: {
    color: '#C0564F',
    fontSize: 13,
    fontWeight: '700',
  },
  avisoOk: {
    backgroundColor: '#DCF0E8',
    borderRadius: 14,
    padding: 12,
  },
  textoAvisoOk: {
    color: '#2F9E82',
    fontSize: 13,
    fontWeight: '700',
  },
});
