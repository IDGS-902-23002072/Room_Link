import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSesion } from '@/auth/SesionContext';
import {
  cargarConfiguracionM08,
  CONFIG_M08_DEFAULT,
  guardarConfiguracionM08,
  obtenerDetalleInmueble,
  type ConfiguracionM08,
  type DetalleInmuebleBackend,
} from './api';

type TabM08 = 'reglas' | 'costos' | 'zona';

const GRUPOS_REGLAS = [
  {
    id: 'visitas' as const,
    titulo: 'Visitas',
    opciones: [
      { id: 'permitidas', etiqueta: 'Permitidas' },
      { id: 'con-aviso', etiqueta: 'Con aviso' },
      { id: 'no', etiqueta: 'No permitidas' },
    ],
  },
  {
    id: 'ruido' as const,
    titulo: 'Horario de silencio',
    opciones: [
      { id: '22h', etiqueta: 'Desde 22:00' },
      { id: '23h', etiqueta: 'Desde 23:00' },
      { id: 'flexible', etiqueta: 'Flexible' },
    ],
  },
  {
    id: 'mascotas' as const,
    titulo: 'Mascotas',
    opciones: [
      { id: 'si', etiqueta: 'Permitidas' },
      { id: 'consultar', etiqueta: 'A consultar' },
      { id: 'no', etiqueta: 'No permitidas' },
    ],
  },
  {
    id: 'tabaco' as const,
    titulo: 'Fumar en casa',
    opciones: [
      { id: 'no', etiqueta: 'No se fuma' },
      { id: 'exterior', etiqueta: 'Solo exterior' },
      { id: 'si', etiqueta: 'Permitido' },
    ],
  },
];

const moneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export function PantallaDetalleInmueble({
  listingId,
  tabInicial = 'reglas',
}: {
  listingId: string;
  tabInicial?: TabM08;
}) {
  const router = useRouter();
  const { sesion } = useSesion();

  const [tab, setTab] = useState<TabM08>(tabInicial);
  const [inmueble, setInmueble] = useState<DetalleInmuebleBackend | null>(null);
  const [config, setConfig] = useState<ConfiguracionM08>(CONFIG_M08_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const esAnfitrion = Boolean(
    sesion?.usuario.id && inmueble && sesion.usuario.id === inmueble.hostId,
  );

  const cargar = useCallback(async () => {
    if (!listingId) {
      setError('Falta el identificador de la habitación.');
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const [detalle, cfg] = await Promise.all([
        obtenerDetalleInmueble(listingId),
        cargarConfiguracionM08(listingId),
      ]);
      setInmueble(detalle);
      setConfig(cfg);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la información del inmueble.',
      );
    } finally {
      setCargando(false);
    }
  }, [listingId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async (mensaje: string) => {
    await guardarConfiguracionM08(listingId, config);
    setAviso(mensaje);
  };

  const abrirMapaExterno = () => {
    if (!inmueble?.location) return;
    const { latitude, longitude } = inmueble.location;
    void Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    );
  };

  const renta = inmueble?.monthlyRent ?? 0;
  const depositoNumerico = config.deposito.trim()
    ? Number(config.deposito.replace(/[^\d.]/g, ''))
    : renta;
  const depositoMostrar = Number.isFinite(depositoNumerico) ? depositoNumerico : renta;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.barraSuperior}>
          <Pressable onPress={() => router.back()} style={styles.botonVolver}>
            <Text style={styles.textoVolver}>‹ Volver</Text>
          </Pressable>
          <Text style={styles.eyebrow}>ROOMLINK / 08</Text>
        </View>

        {inmueble && (
          <View>
            <Text style={styles.tituloInmueble}>{inmueble.title}</Text>
            <Text style={styles.subtitulo}>
              {moneda.format(inmueble.monthlyRent)} / mes
              {inmueble.maxRoommates
                ? ` · Hasta ${inmueble.maxRoommates} compañeros`
                : ''}
            </Text>
          </View>
        )}

        <View style={styles.tabs}>
          {(
            [
              ['reglas', 'Reglas'],
              ['costos', 'Costos claros'],
              ['zona', 'Conoce la zona'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => {
                setTab(id);
                setAviso(null);
              }}
              style={[styles.tab, tab === id && styles.tabActiva]}
            >
              <Text style={[styles.tabTexto, tab === id && styles.tabTextoActivo]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {cargando ? (
          <View style={styles.centrado}>
            <ActivityIndicator size="large" color="#84658D" />
            <Text style={styles.subtitulo}>Cargando detalles del inmueble…</Text>
          </View>
        ) : error ? (
          <View style={styles.avisoError}>
            <Text style={styles.textoError}>{error}</Text>
            <Pressable style={styles.botonSecundario} onPress={() => void cargar()}>
              <Text style={styles.textoSecundario}>Reintentar</Text>
            </Pressable>
          </View>
        ) : !inmueble ? null : tab === 'reglas' ? (
          <>
            <Text style={styles.tituloSeccion}>Reglas de la casa</Text>
            <Text style={styles.subtitulo}>
              Haz claras las expectativas desde el inicio.
            </Text>

            {GRUPOS_REGLAS.map((grupo) => (
              <View key={grupo.id} style={styles.tarjeta}>
                <Text style={styles.etiqueta}>{grupo.titulo}</Text>
                <View style={styles.filaOpciones}>
                  {grupo.opciones.map((op) => {
                    const activa = config.reglas[grupo.id] === op.id;
                    return (
                      <Pressable
                        key={op.id}
                        disabled={!esAnfitrion}
                        onPress={() =>
                          setConfig((prev) => ({
                            ...prev,
                            reglas: { ...prev.reglas, [grupo.id]: op.id },
                          }))
                        }
                        style={[
                          styles.opcion,
                          activa && styles.opcionActiva,
                        ]}
                      >
                        <Text
                          style={[
                            styles.textoOpcion,
                            activa && styles.textoOpcionActiva,
                          ]}
                        >
                          {op.etiqueta}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Reglas adicionales</Text>
              {esAnfitrion ? (
                <TextInput
                  value={config.reglasAdicionales}
                  onChangeText={(reglasAdicionales) =>
                    setConfig((prev) => ({ ...prev, reglasAdicionales }))
                  }
                  multiline
                  style={styles.input}
                  placeholder="Escribe una regla adicional"
                  placeholderTextColor="#9A909E"
                />
              ) : (
                <Text style={styles.valor}>
                  {config.reglasAdicionales || 'Sin reglas adicionales registradas.'}
                </Text>
              )}
            </View>

            {inmueble.description ? (
              <View style={styles.tarjeta}>
                <Text style={styles.etiqueta}>Descripción de la publicación</Text>
                <Text style={styles.valor}>{inmueble.description}</Text>
              </View>
            ) : null}

            {aviso && (
              <View style={styles.avisoExito}>
                <Text style={styles.textoExito}>{aviso}</Text>
              </View>
            )}

            {esAnfitrion && (
              <Pressable
                style={styles.botonPrincipal}
                onPress={() => void guardar('Reglas de la casa guardadas.')}
              >
                <Text style={styles.textoPrincipal}>Guardar reglas</Text>
              </Pressable>
            )}
          </>
        ) : tab === 'costos' ? (
          <>
            <Text style={styles.tituloSeccion}>Costos claros</Text>
            <Text style={styles.subtitulo}>
              Desglose transparente basado en la publicación real.
            </Text>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Renta mensual</Text>
              <Text style={styles.valorDestacado}>{moneda.format(renta)}</Text>
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Depósito de garantía estimado</Text>
              {esAnfitrion ? (
                <TextInput
                  value={config.deposito}
                  onChangeText={(deposito) =>
                    setConfig((prev) => ({ ...prev, deposito }))
                  }
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder={`${renta} (equivalente a 1 mes)`}
                  placeholderTextColor="#9A909E"
                />
              ) : (
                <Text style={styles.valor}>{moneda.format(depositoMostrar)}</Text>
              )}
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Servicios y condiciones</Text>
              {esAnfitrion ? (
                <TextInput
                  value={config.serviciosIncluidos}
                  onChangeText={(serviciosIncluidos) =>
                    setConfig((prev) => ({ ...prev, serviciosIncluidos }))
                  }
                  multiline
                  style={styles.input}
                  placeholder="Ej. Agua, luz, internet…"
                  placeholderTextColor="#9A909E"
                />
              ) : (
                <Text style={styles.valor}>{config.serviciosIncluidos}</Text>
              )}
            </View>

            <View style={styles.tarjetaMenta}>
              <Text style={styles.tituloMenta}>
                Total mensual estimado · {moneda.format(renta)}
              </Text>
              <Text style={styles.textoMenta}>
                {inmueble.availableFrom
                  ? `Disponible desde ${inmueble.availableFrom}. `
                  : ''}
                Sin comisiones ocultas de RoomLink. Confirma el detalle final en tu
                Acuerdo de convivencia.
              </Text>
            </View>

            {aviso && (
              <View style={styles.avisoExito}>
                <Text style={styles.textoExito}>{aviso}</Text>
              </View>
            )}

            {esAnfitrion && (
              <Pressable
                style={styles.botonPrincipal}
                onPress={() => void guardar('Desglose de costos guardado.')}
              >
                <Text style={styles.textoPrincipal}>Guardar desglose</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={styles.tituloSeccion}>Conoce la zona</Text>
            <Text style={styles.subtitulo}>
              Ubicación aproximada y referencias del inmueble.
            </Text>

            <View style={styles.tarjetaMapa}>
              <Text style={styles.iconoMapa}>📍</Text>
              <Text style={styles.nombreMapa}>
                {inmueble.location?.address ?? 'Ubicación no especificada aún'}
              </Text>
              {inmueble.location && (
                <>
                  <Text style={styles.coordenadas}>
                    Lat {inmueble.location.latitude.toFixed(4)} · Lng{' '}
                    {inmueble.location.longitude.toFixed(4)}
                  </Text>
                  <Pressable
                    style={styles.botonSecundario}
                    onPress={abrirMapaExterno}
                  >
                    <Text style={styles.textoSecundario}>Abrir en mapa</Text>
                  </Pressable>
                </>
              )}
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Referencias cercanas</Text>
              {esAnfitrion ? (
                <TextInput
                  value={config.lugaresCercanos}
                  onChangeText={(lugaresCercanos) =>
                    setConfig((prev) => ({ ...prev, lugaresCercanos }))
                  }
                  multiline
                  style={styles.input}
                  placeholder="Ej. A 10 min del campus, parada de transporte a 2 cuadras…"
                  placeholderTextColor="#9A909E"
                />
              ) : (
                <Text style={styles.valor}>
                  {config.lugaresCercanos ||
                    'Consulta con el anfitrión por rutas de transporte y servicios cercanos.'}
                </Text>
              )}
            </View>

            <View style={styles.tarjetaMenta}>
              <Text style={styles.tituloMenta}>Privacidad de ubicación</Text>
              <Text style={styles.textoMenta}>
                La dirección exacta y referencias de acceso se comparten únicamente al
                confirmar una visita o aceptar la postulación.
              </Text>
            </View>

            {aviso && (
              <View style={styles.avisoExito}>
                <Text style={styles.textoExito}>{aviso}</Text>
              </View>
            )}

            {esAnfitrion && (
              <Pressable
                style={styles.botonPrincipal}
                onPress={() => void guardar('Referencias de la zona guardadas.')}
              >
                <Text style={styles.textoPrincipal}>Guardar referencias</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F6F2F7' },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  botonVolver: { paddingVertical: 6, paddingRight: 12 },
  textoVolver: { color: '#84658D', fontSize: 15, fontWeight: '700' },
  eyebrow: { color: '#84658D', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  tituloInmueble: { color: '#2B2430', fontSize: 20, fontWeight: '700' },
  tituloSeccion: { color: '#2B2430', fontSize: 22, fontWeight: '700' },
  subtitulo: { color: '#786D7E', fontSize: 13, lineHeight: 19 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E9DDEA',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  tabActiva: { backgroundColor: '#FFFFFF' },
  tabTexto: { color: '#786D7E', fontSize: 12, fontWeight: '600' },
  tabTextoActivo: { color: '#654C6D', fontWeight: '700' },
  centrado: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE5EF',
    padding: 14,
    gap: 8,
  },
  etiqueta: { color: '#786D7E', fontSize: 12, fontWeight: '700' },
  valor: { color: '#2B2430', fontSize: 14, lineHeight: 20 },
  valorDestacado: { color: '#84658D', fontSize: 24, fontWeight: '800' },
  filaOpciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opcion: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1EAF3',
  },
  opcionActiva: { backgroundColor: '#84658D' },
  textoOpcion: { color: '#654C6D', fontSize: 12, fontWeight: '600' },
  textoOpcionActiva: { color: '#FFFFFF' },
  input: {
    color: '#2B2430',
    fontSize: 14,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#E5DAE9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  tarjetaMenta: {
    backgroundColor: '#CFEFE8',
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  tituloMenta: { color: '#1F4B43', fontSize: 15, fontWeight: '700' },
  textoMenta: { color: '#2E5D55', fontSize: 13, lineHeight: 19 },
  tarjetaMapa: {
    backgroundColor: '#EFE4F2',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  iconoMapa: { fontSize: 32 },
  nombreMapa: {
    color: '#2B2430',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  coordenadas: { color: '#6E6275', fontSize: 12 },
  botonPrincipal: {
    backgroundColor: '#84658D',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  textoPrincipal: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  botonSecundario: {
    backgroundColor: '#E9DAEC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  textoSecundario: { color: '#654C6D', fontSize: 13, fontWeight: '700' },
  avisoExito: { backgroundColor: '#DCF0E8', borderRadius: 12, padding: 12 },
  textoExito: { color: '#1F6F60', fontSize: 13, fontWeight: '600' },
  avisoError: {
    backgroundColor: '#FCE8E8',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  textoError: { color: '#A33D4D', fontSize: 13, fontWeight: '600' },
});
